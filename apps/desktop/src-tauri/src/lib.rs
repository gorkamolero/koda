// Koda Desktop - Native Shell Library
// Tauri 2.x application with sidecar orchestration via Unix sockets

pub mod commands;
pub mod ipc;
mod notification_listener;

use commands::SidecarState;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{App, Manager, RunEvent};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

// Global sidecar process handle for cleanup
static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Kill the sidecar process if it's running
fn kill_sidecar() {
    if let Some(mut child) = SIDECAR_PROCESS.lock().unwrap().take() {
        tracing::info!("Stopping sidecar process (PID: {:?})", child.id());
        #[cfg(unix)]
        {
            // Let Node close sockets and abort its agent children before forcing
            // termination. Child::kill alone sends SIGKILL and skips all cleanup.
            let _ = Command::new("/bin/kill").arg("-TERM").arg(child.id().to_string()).status();
            for _ in 0..50 {
                if matches!(child.try_wait(), Ok(Some(_))) { return; }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }
        if let Err(e) = child.kill() {
            tracing::warn!("Failed to kill sidecar: {}", e);
        }
        // Wait for process to fully terminate
        let _ = child.wait();
    }
}

/// Initialize the Tauri application with plugins and setup
pub fn run() {
    let mut context = tauri::generate_context!();
    let mut window_state = tauri_plugin_window_state::Builder::default();
    if let Some(directory) = std::env::var_os("KODA_DATA_DIR") {
        let directory = PathBuf::from(directory);
        std::fs::create_dir_all(&directory).expect("failed to create KODA_DATA_DIR");
        let directory = directory.canonicalize().expect("invalid KODA_DATA_DIR");
        let identifier = webview_store_identifier(&directory).expect("failed to initialize isolated webview profile");
        for window in &mut context.config_mut().app.windows {
            // WKWebView requires a distinct data-store identifier on macOS14+.
            // A data directory alone would leave both users sharing localStorage.
            #[cfg(target_os = "macos")]
            { window.data_store_identifier = Some(identifier); }
            #[cfg(not(target_os = "macos"))]
            { window.data_directory = Some(directory.join("webview")); }
        }
        window_state = window_state.with_filename(directory.join("window-state.json").to_string_lossy());
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(window_state.build())
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
        .build(context)
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let RunEvent::Exit = event {
                kill_sidecar();
            }
        });
}

/// Persist the profile identifier so browser storage also survives a restart.
fn webview_store_identifier(directory: &std::path::Path) -> Result<[u8; 16], Box<dyn std::error::Error>> {
    let file = directory.join("webview-profile.json");
    if file.exists() {
        return Ok(serde_json::from_slice(&std::fs::read(file)?)?);
    }
    // Two stable FNV hashes distinguish independent directories without adding a
    // dependency. This identifier is a namespace, never an authentication token.
    let mut first = 0xcbf29ce484222325u64;
    let mut second = 0x84222325cbf29ce4u64;
    for byte in directory.to_string_lossy().bytes() {
        first = (first ^ u64::from(byte)).wrapping_mul(0x100000001b3);
        second = (second ^ u64::from(byte)).wrapping_mul(0x100000001b3);
    }
    let mut identifier = [0u8; 16];
    identifier[..8].copy_from_slice(&first.to_le_bytes());
    identifier[8..].copy_from_slice(&second.to_le_bytes());
    std::fs::write(file, serde_json::to_vec(&identifier)?)?;
    Ok(identifier)
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
    let app_dir = std::env::var_os("KODA_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| app.path().app_data_dir().expect("failed to get app data directory"));

    // Ensure app data directory exists
    std::fs::create_dir_all(&app_dir)?;

    tracing::info!("App data directory: {:?}", app_dir);

    // Use socket path from env var if set (test mode), otherwise compute based on platform
    let socket_path = std::env::var("KODA_SOCKET")
        .unwrap_or_else(|_| get_socket_path(&app_dir));
    tracing::info!("Socket path: {}", socket_path);
    #[cfg(unix)]
    if std::os::unix::net::UnixStream::connect(&socket_path).is_ok() {
        return Err("Another Koda instance already uses this data directory. Choose a separate KODA_DATA_DIR.".into());
    }

    // Ensure socket directory exists (for test mode)
    if let Some(parent) = std::path::Path::new(&socket_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    // Spawn sidecar immediately during setup (before frontend loads)
    let sidecar_path = get_sidecar_path(app)?;
    tracing::info!("Spawning sidecar from: {:?}", sidecar_path);

    // Build sidecar command with env vars
    // Inherit KODA_TEST_DB and KODA_SOCKET from parent process for test isolation
    let mut cmd = Command::new(std::env::var("KODA_NODE_PATH").unwrap_or_else(|_| "node".into()));
    cmd.env("KODA_SOCKET", &socket_path)
        .arg(sidecar_path.to_str().unwrap())
        .arg("--app-dir")
        .arg(app_dir.to_str().unwrap());

    // Pass through test database path if set
    if let Ok(test_db) = std::env::var("KODA_TEST_DB") {
        tracing::info!("Using test database: {}", test_db);
        cmd.env("KODA_TEST_DB", test_db);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let pid = child.id();
    tracing::info!("Sidecar spawned with PID: {}", pid);

    // Wait for the actual sidecar socket, and surface early failures such as a
    // missing build or a second instance attempting to reuse the same data.
    let mut ready = false;
    for _ in 0..100 {
        std::thread::sleep(std::time::Duration::from_millis(100));
        if let Some(status) = child.try_wait()? {
            return Err(format!("Koda sidecar exited before startup ({status}). Check its output above.").into());
        }
        #[cfg(unix)]
        if std::os::unix::net::UnixStream::connect(&socket_path).is_ok() {
            ready = true;
            break;
        }
        #[cfg(not(unix))]
        { ready = true; break; }
    }
    if !ready {
        let _ = child.kill();
        let _ = child.wait();
        return Err("Koda sidecar did not become ready within 10 seconds".into());
    }
    *SIDECAR_PROCESS.lock().unwrap() = Some(child);

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
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
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
