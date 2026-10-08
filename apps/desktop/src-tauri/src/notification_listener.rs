//! Persistent notification listener for real-time streaming
//!
//! Maintains a persistent Unix socket connection to the sidecar,
//! reading JSON-RPC notifications and emitting them as Tauri events.

use serde::Deserialize;
use std::thread;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::UnixStream;

/// JSON-RPC notification (no id field)
#[derive(Debug, Deserialize)]
struct JsonRpcNotification {
    #[allow(dead_code)]
    jsonrpc: String,
    method: String,
    params: Option<serde_json::Value>,
}

/// Spawn the notification listener in a background thread
pub fn spawn_listener(socket_path: String, app_handle: AppHandle) {
    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            // Retry connection with backoff
            let mut retry_delay = 100;
            loop {
                match run_listener(&socket_path, &app_handle).await {
                    Ok(()) => {
                        tracing::info!("[NotificationListener] Connection closed, reconnecting...");
                        retry_delay = 100; // Reset on successful connection
                    }
                    Err(e) => {
                        tracing::warn!(
                            "[NotificationListener] Connection error: {}. Retrying in {}ms...",
                            e,
                            retry_delay
                        );
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(retry_delay)).await;
                retry_delay = (retry_delay * 2).min(5000); // Exponential backoff, max 5s
            }
        });
    });

    tracing::info!("[NotificationListener] Background listener spawned");
}

/// Run the notification listener (connects and reads until disconnect)
async fn run_listener(socket_path: &str, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("[NotificationListener] Connecting to {}", socket_path);

    let stream = UnixStream::connect(socket_path).await?;
    tracing::info!("[NotificationListener] Connected! Listening for notifications...");

    let reader = BufReader::new(stream);
    let mut lines = reader.lines();

    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }

        // Try to parse as notification (has method but no id, or id is null)
        match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(value) => {
                // Check if this is a notification (has method, no id or null id)
                let is_notification = value.get("method").is_some()
                    && (value.get("id").is_none() || value.get("id") == Some(&serde_json::Value::Null));

                if is_notification {
                    if let Ok(notification) = serde_json::from_value::<JsonRpcNotification>(value) {
                        handle_notification(app_handle, notification);
                    }
                }
                // Ignore responses (they're handled by request-response flow)
            }
            Err(e) => {
                tracing::warn!("[NotificationListener] Failed to parse notification: {}", e);
            }
        }
    }

    Ok(())
}

/// Handle a notification by emitting it as a Tauri event
fn handle_notification(app_handle: &AppHandle, notification: JsonRpcNotification) {
    let event_name = format!("sidecar-notification:{}", notification.method);

    // Emit both specific event and generic event
    if let Some(params) = &notification.params {
        // Specific event (e.g., "sidecar-notification:message")
        app_handle.emit(&event_name, params.clone()).ok();

        // Generic event for catch-all listeners
        app_handle
            .emit(
                "sidecar-notification",
                serde_json::json!({
                    "method": notification.method,
                    "params": params
                }),
            )
            .ok();

        tracing::debug!(
            "[NotificationListener] Emitted {} event",
            notification.method
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_parsing() {
        let json = r#"{"jsonrpc":"2.0","method":"message","params":{"sessionId":"abc","event":{"type":"text"}}}"#;
        let notification: JsonRpcNotification = serde_json::from_str(json).unwrap();
        assert_eq!(notification.method, "message");
        assert!(notification.params.is_some());
    }

    #[test]
    fn test_response_not_notification() {
        let json = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"ok"}}"#;
        let result: Result<JsonRpcNotification, _> = serde_json::from_str(json);
        // Should fail because there's no method field
        assert!(result.is_err());
    }
}
