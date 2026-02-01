//! Tauri commands - invokable from the frontend

use crate::ipc::{IpcError, SocketClient};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;

/// Global request ID counter for JSON-RPC
static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// State container for the socket client
pub struct SidecarState {
    pub socket_path: String,
    pub client: Arc<Mutex<Option<SocketClient>>>,
    pub pid: Arc<Mutex<Option<u32>>>,
}

impl SidecarState {
    pub fn new(socket_path: String) -> Self {
        Self {
            socket_path,
            client: Arc::new(Mutex::new(None)),
            pid: Arc::new(Mutex::new(None)),
        }
    }

    /// Get or create a socket client
    pub async fn get_client(&self) -> Result<SocketClient, IpcError> {
        let mut guard = self.client.lock().await;

        if guard.is_none() {
            let client = SocketClient::new(&self.socket_path);
            if !client.is_available() {
                return Err(IpcError::ConnectionFailed(
                    "Socket not available. Is the sidecar running?".to_string(),
                ));
            }
            *guard = Some(client);
        }

        // Clone the client (it's cheap - just holds the path)
        Ok(SocketClient::new(&self.socket_path))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SidecarStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub socket_path: String,
}

/// Health check command - verifies Tauri app is responsive
#[tauri::command]
pub async fn health_check() -> Result<HealthResponse, String> {
    Ok(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Spawn the Node.js sidecar process
#[tauri::command]
pub async fn spawn_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<SidecarStatus, String> {
    use tauri_plugin_shell::ShellExt;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure app data directory exists
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    // In production, sidecar will be bundled. For dev, we expect it in workspace
    let (sidecar_path, resources_path) = if cfg!(debug_assertions) {
        // Dev mode: workspace relative path (from src-tauri directory)
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let manifest_path = PathBuf::from(&manifest_dir);
        let sidecar = manifest_path
            .join("..")
            .join("..")
            .join("sidecar")
            .join("dist")
            .join("index.js");
        // Resources are in src-tauri/resources during dev
        let resources = manifest_path.join("resources");
        (sidecar, resources)
    } else {
        // Production: bundled in resources
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?;
        let sidecar = resource_dir.join("sidecar").join("index.js");
        (sidecar, resource_dir)
    };

    tracing::info!("Spawning sidecar from: {:?}", sidecar_path);
    tracing::info!("Resources path: {:?}", resources_path);

    // Spawn sidecar using shell plugin
    let (_, child) = app
        .shell()
        .command("node")
        .env("KODA_SOCKET", &state.socket_path)
        .env("KODA_RESOURCES_PATH", resources_path.to_str().unwrap_or(""))
        .args([
            sidecar_path.to_str().unwrap(),
            "--app-dir",
            app_dir.to_str().unwrap(),
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Store PID
    let pid = child.pid();
    {
        let mut pid_guard = state.pid.lock().await;
        *pid_guard = Some(pid);
    }

    // Emit event to frontend
    let status = SidecarStatus {
        running: true,
        pid: Some(pid),
        socket_path: state.socket_path.clone(),
    };

    app.emit("sidecar-status", status.clone())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    tracing::info!("Sidecar spawned with PID: {}", pid);

    Ok(status)
}

/// Get current sidecar status
#[tauri::command]
pub async fn get_sidecar_status(state: State<'_, SidecarState>) -> Result<SidecarStatus, String> {
    let pid = *state.pid.lock().await;
    let client = SocketClient::new(&state.socket_path);

    Ok(SidecarStatus {
        running: client.is_available(),
        pid,
        socket_path: state.socket_path.clone(),
    })
}

/// Connect to the Unix socket
#[tauri::command]
pub async fn connect_socket(state: State<'_, SidecarState>) -> Result<String, String> {
    // Check if socket is available
    let client = SocketClient::new(&state.socket_path);

    if !client.is_available() {
        return Err("Socket not available. Spawn sidecar first.".to_string());
    }

    Ok(state.socket_path.clone())
}

/// Send JSON-RPC request to sidecar via Unix socket
#[tauri::command]
pub async fn send_rpc_request(
    app: AppHandle,
    state: State<'_, SidecarState>,
    method: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    tracing::info!("RPC request: method={}, params={:?}", method, params);

    // Get client
    let client = state
        .get_client()
        .await
        .map_err(|e| format!("Failed to get client: {}", e))?;

    // Generate unique request ID
    let request_id = REQUEST_ID.fetch_add(1, Ordering::SeqCst);

    // Send request
    let response = client
        .send_request(method.clone(), params, request_id)
        .await
        .map_err(|e| format!("RPC request failed: {}", e))?;

    // Check for error
    if let Some(error) = response.error {
        // Emit error event
        app.emit(
            "rpc-error",
            serde_json::json!({
                "method": method,
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "data": error.data
                }
            }),
        )
        .ok(); // Ignore emit errors

        return Err(format!("RPC error ({}): {}", error.code, error.message));
    }

    // Return result
    response
        .result
        .ok_or_else(|| "Empty response from sidecar".to_string())
}

/// Stop the sidecar process
#[tauri::command]
pub async fn stop_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<SidecarStatus, String> {
    let pid = {
        let mut pid_guard = state.pid.lock().await;
        pid_guard.take()
    };

    if let Some(pid) = pid {
        // Send SIGTERM to the process
        #[cfg(unix)]
        {
            use std::process::Command;
            Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;

            tracing::info!("Sent SIGTERM to sidecar PID: {}", pid);
        }

        #[cfg(windows)]
        {
            use std::process::Command;
            Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;

            tracing::info!("Killed sidecar PID: {}", pid);
        }
    }

    // Clear the client
    {
        let mut client_guard = state.client.lock().await;
        *client_guard = None;
    }

    let status = SidecarStatus {
        running: false,
        pid: None,
        socket_path: state.socket_path.clone(),
    };

    app.emit("sidecar-status", status.clone())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let result = health_check().await;
        assert!(result.is_ok());

        let health = result.unwrap();
        assert_eq!(health.status, "ok");
        assert!(!health.version.is_empty());
    }

    #[test]
    fn test_health_response_serialization() {
        let response = HealthResponse {
            status: "ok".to_string(),
            version: "0.1.0".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("ok"));
        assert!(json.contains("0.1.0"));
    }

    #[test]
    fn test_sidecar_status_serialization() {
        let status = SidecarStatus {
            running: true,
            pid: Some(1234),
            socket_path: "/tmp/test.sock".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("true"));
        assert!(json.contains("1234"));
        assert!(json.contains("/tmp/test.sock"));
    }

    #[test]
    fn test_request_id_increments() {
        let id1 = REQUEST_ID.fetch_add(1, Ordering::SeqCst);
        let id2 = REQUEST_ID.fetch_add(1, Ordering::SeqCst);
        assert!(id2 > id1);
    }
}
