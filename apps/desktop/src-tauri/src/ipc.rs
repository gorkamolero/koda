//! IPC module - Unix socket communication with sidecar

use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

#[derive(Error, Debug)]
pub enum IpcError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Unix socket client for communicating with the sidecar
pub struct SocketClient {
    socket_path: String,
}

impl SocketClient {
    /// Create a new socket client
    pub fn new<P: AsRef<Path>>(socket_path: P) -> Self {
        Self {
            socket_path: socket_path.as_ref().to_string_lossy().to_string(),
        }
    }

    /// Send a JSON-RPC request and wait for response
    pub async fn send_request(
        &self,
        method: String,
        params: serde_json::Value,
        request_id: u64,
    ) -> Result<JsonRpcResponse, IpcError> {
        // Connect to Unix socket
        let stream = UnixStream::connect(&self.socket_path)
            .await
            .map_err(|e| IpcError::ConnectionFailed(e.to_string()))?;

        let (reader, mut writer) = stream.into_split();

        // Build JSON-RPC request
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: request_id,
            method,
            params,
        };

        // Serialize and send (newline-delimited)
        let request_json = serde_json::to_string(&request)?;
        let request_bytes = format!("{}\n", request_json);

        writer.write_all(request_bytes.as_bytes()).await?;
        writer.flush().await?;

        // The sidecar broadcasts streaming notifications on every connected
        // socket, including this request socket. The persistent listener forwards
        // those to the UI; wait here for this request's matching response.
        let mut buf_reader = BufReader::new(reader);
        let mut response_line = String::new();
        loop {
            response_line.clear();
            if buf_reader.read_line(&mut response_line).await? == 0 {
                return Err(IpcError::InvalidResponse("Sidecar closed before responding".into()));
            }
            let message: serde_json::Value = serde_json::from_str(response_line.trim())?;
            if message.get("method").is_some() {
                continue;
            }
            if message.get("id").and_then(serde_json::Value::as_u64) != Some(request_id) {
                continue;
            }
            return Ok(serde_json::from_value(message)?);
        }
    }

    /// Check if socket exists and is accessible
    pub fn is_available(&self) -> bool {
        Path::new(&self.socket_path).exists()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn notifications_before_response_do_not_break_native_rpc() {
        let socket_path = std::env::temp_dir().join(format!("koda-ipc-native-{}.sock", std::process::id()));
        let listener = tokio::net::UnixListener::bind(&socket_path).unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.split();
            let mut request = String::new();
            BufReader::new(reader).read_line(&mut request).await.unwrap();
            writer.write_all(b"{\"jsonrpc\":\"2.0\",\"method\":\"sessionStatus\",\"params\":{\"status\":\"running\"}}\n{\"jsonrpc\":\"2.0\",\"id\":42,\"result\":{\"accepted\":true}}\n").await.unwrap();
        });
        let result = SocketClient::new(&socket_path)
            .send_request("codex.send".into(), serde_json::json!({}), 42).await.unwrap();
        assert_eq!(result.result.unwrap()["accepted"], true);
        server.await.unwrap();
        std::fs::remove_file(socket_path).unwrap();
    }

    #[test]
    fn test_socket_client_creation() {
        let client = SocketClient::new("/tmp/test.sock");
        assert!(client.socket_path.contains("test.sock"));
    }

    #[test]
    fn test_socket_availability() {
        let client = SocketClient::new("/nonexistent/socket.sock");
        assert!(!client.is_available());
    }

    #[test]
    fn test_jsonrpc_request_serialization() {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "test_method".to_string(),
            params: serde_json::json!({"key": "value"}),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("2.0"));
        assert!(json.contains("test_method"));
        assert!(json.contains("key"));
    }

    #[test]
    fn test_jsonrpc_response_deserialization() {
        let json = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"ok"}}"#;
        let response: JsonRpcResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, 1);
        assert!(response.result.is_some());
        assert!(response.error.is_none());
    }

    #[test]
    fn test_jsonrpc_error_response() {
        let json = r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Invalid Request"}}"#;
        let response: JsonRpcResponse = serde_json::from_str(json).unwrap();

        assert!(response.result.is_none());
        assert!(response.error.is_some());

        let error = response.error.unwrap();
        assert_eq!(error.code, -32600);
        assert_eq!(error.message, "Invalid Request");
    }
}
