// Koda Desktop - Native Shell Library
// Tauri 2.x application with sidecar orchestration via Unix sockets

pub mod commands;
pub mod ipc;
mod notification_listener;

use commands::SidecarState;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{App, Manager};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

// Global sidecar process handle for cleanup
static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Initialize the Tauri application with plugins and setup
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::spawn_sidecar,
            commands::get_sidecar_status,
            commands::connect_socket,
            commands::send_rpc_request,
            commands::stop_sidecar,
        ])
        .setup(|app| {
            setup_tracing();
            setup_app(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Configure tracing/logging
fn setup_tracing() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();
}

/// Application setup hook
fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Koda desktop application starting");

    // Check if we're in test mode (env vars set by Playwright)
    let is_test_mode = std::env::var("KODA_TEST_DB").is_ok();
    if is_test_mode {
        tracing::info!("Running in TEST mode - using test database and socket");
    }

    // Get app data directory
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data directory");

    // Ensure app data directory exists
    std::fs::create_dir_all(&app_dir)?;

    tracing::info!("App data directory: {:?}", app_dir);

    // Use socket path from env var if set (test mode), otherwise compute based on platform
    let socket_path = std::env::var("KODA_SOCKET")
        .unwrap_or_else(|_| get_socket_path(&app_dir));
    tracing::info!("Socket path: {}", socket_path);

    // Ensure socket directory exists (for test mode)
    if let Some(parent) = std::path::Path::new(&socket_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    // Clean up stale socket file from previous runs
    let socket_file = std::path::Path::new(&socket_path);
    if socket_file.exists() {
        tracing::info!("Removing stale socket file");
        std::fs::remove_file(socket_file).ok();
    }

    // Spawn sidecar immediately during setup (before frontend loads)
    let sidecar_path = get_sidecar_path(app)?;
    tracing::info!("Spawning sidecar from: {:?}", sidecar_path);

    // Build sidecar command with env vars
    // Inherit KODA_TEST_DB and KODA_SOCKET from parent process for test isolation
    let mut cmd = Command::new("node");
    cmd.env("KODA_SOCKET", &socket_path)
        .arg(sidecar_path.to_str().unwrap())
        .arg("--app-dir")
        .arg(app_dir.to_str().unwrap());

    // Pass through test database path if set
    if let Ok(test_db) = std::env::var("KODA_TEST_DB") {
        tracing::info!("Using test database: {}", test_db);
        cmd.env("KODA_TEST_DB", test_db);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let pid = child.id();
    tracing::info!("Sidecar spawned with PID: {}", pid);

    // Store process handle for cleanup
    *SIDECAR_PROCESS.lock().unwrap() = Some(child);

    // Wait a moment for socket to be ready
    std::thread::sleep(std::time::Duration::from_millis(500));

    // Register sidecar state with the PID
    let state = SidecarState::new(socket_path.clone());
    {
        // Set the PID in the state - we need to do this via a runtime
        let pid_clone = pid;
        let state_pid = state.pid.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                *state_pid.lock().await = Some(pid_clone);
            });
        });
    }
    app.manage(state);

    // Spawn persistent notification listener for real-time streaming
    let app_handle = app.handle().clone();
    notification_listener::spawn_listener(socket_path, app_handle);

    Ok(())
}

/// Get the sidecar path based on build mode
fn get_sidecar_path(app: &App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        // Dev mode: workspace relative path
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        Ok(PathBuf::from(&manifest_dir)
            .join("..")
            .join("..")
            .join("sidecar")
            .join("dist")
            .join("index.js"))
    } else {
        // Production: bundled in resources
        Ok(app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?
            .join("sidecar")
            .join("index.js"))
    }
}

/// Get the Unix socket path based on platform
fn get_socket_path(app_dir: &std::path::Path) -> String {
    #[cfg(target_os = "macos")]
    {
        // macOS: ~/Library/Application Support/com.koda.app/koda.sock
        app_dir.join("koda.sock").to_string_lossy().to_string()
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: /tmp/koda-{uid}.sock
        format!("/tmp/koda-{}.sock", unsafe { libc::getuid() })
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: \\.\pipe\koda
        "\\\\.\\pipe\\koda".to_string()
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        // Fallback: use app data directory
        app_dir.join("koda.sock").to_string_lossy().to_string()
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_library_compiles() {
        // Basic compilation test
        assert!(true);
    }

    #[test]
    fn test_socket_path_format() {
        let temp_dir = std::path::PathBuf::from("/tmp/test-app");
        let socket_path = super::get_socket_path(&temp_dir);

        // Should have "koda.sock" in the path on macOS
        #[cfg(target_os = "macos")]
        assert!(socket_path.contains("koda.sock"));

        // Should have "koda-" prefix on Linux
        #[cfg(target_os = "linux")]
        assert!(socket_path.starts_with("/tmp/koda-"));

        // Should be a pipe on Windows
        #[cfg(target_os = "windows")]
        assert!(socket_path.contains("pipe"));
    }
}
