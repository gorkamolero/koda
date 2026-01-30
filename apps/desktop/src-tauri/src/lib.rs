// Koda Desktop - Native Shell Library
// Tauri 2.x application with sidecar orchestration via Unix sockets

pub mod commands;
pub mod ipc;

use commands::SidecarState;
use tauri::{App, Manager};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

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

    // Get app data directory
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data directory");

    // Ensure app data directory exists
    std::fs::create_dir_all(&app_dir)?;

    tracing::info!("App data directory: {:?}", app_dir);

    // Compute socket path based on platform
    let socket_path = get_socket_path(&app_dir);
    tracing::info!("Socket path: {}", socket_path);

    // Register sidecar state
    app.manage(SidecarState::new(socket_path));

    Ok(())
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
