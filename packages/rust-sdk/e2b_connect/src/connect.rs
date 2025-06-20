//! Connect RPC client implementation for E2B
//!
//! This module implements the Connect RPC protocol used by E2B services,
//! which is compatible with but distinct from traditional gRPC.

use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Connect RPC client error types
#[derive(Error, Debug)]
pub enum ConnectError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("JSON serialization failed: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Connect RPC error: code={code}, message={message}")]
    Rpc { code: i32, message: String },
    
    #[error("Invalid response format: {0}")]
    InvalidResponse(String),
}

/// Result type for Connect RPC operations
pub type ConnectResult<T> = Result<T, ConnectError>;

/// Connect RPC client configuration
#[derive(Debug, Clone)]
pub struct ConnectConfig {
    /// Base URL for the Connect service
    pub base_url: String,
    /// Headers to include with requests
    pub headers: HashMap<String, String>,
    /// Request timeout in seconds
    pub timeout_secs: u64,
    /// Whether to use JSON encoding (true) or protobuf (false)
    pub use_json: bool,
}

impl Default for ConnectConfig {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            headers: HashMap::new(),
            timeout_secs: 30,
            use_json: true, // Default to JSON like Python SDK
        }
    }
}

/// Connect RPC client for making HTTP-based RPC calls
#[derive(Debug, Clone)]
pub struct ConnectClient {
    client: Client,
    config: ConnectConfig,
}

impl ConnectClient {
    /// Create a new Connect RPC client
    pub fn new(config: ConnectConfig) -> ConnectResult<Self> {
        let mut client_builder = Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs));
            
        // Add default headers
        let mut headers = reqwest::header::HeaderMap::new();
        for (key, value) in &config.headers {
            headers.insert(
                reqwest::header::HeaderName::from_bytes(key.as_bytes())
                    .map_err(|e| ConnectError::InvalidResponse(format!("Invalid header name: {}", e)))?,
                reqwest::header::HeaderValue::from_str(value)
                    .map_err(|e| ConnectError::InvalidResponse(format!("Invalid header value: {}", e)))?,
            );
        }
        client_builder = client_builder.default_headers(headers);
        
        let client = client_builder.build()?;
        
        Ok(Self { client, config })
    }
    
    /// Create a Connect RPC request envelope
    fn create_request_envelope(&self, data: &[u8]) -> ConnectResult<Vec<u8>> {
        let mut envelope = Vec::new();
        
        // Connect RPC envelope header: 1 byte flags + 4 bytes length (little-endian)
        let flags = 0u8; // No special flags for regular request
        let data_length = data.len() as u32;
        
        envelope.push(flags);
        envelope.extend_from_slice(&data_length.to_be_bytes());
        envelope.extend_from_slice(data);
        
        tracing::debug!("Created request envelope: flags={:02x}, length={}, total_size={}", 
                       flags, data_length, envelope.len());
        
        Ok(envelope)
    }
    
    /// Make a unary Connect RPC call
    pub async fn call_unary<Req, Resp>(
        &self,
        service: &str,
        method: &str,
        request: &Req,
    ) -> ConnectResult<Resp>
    where
        Req: Serialize,
        Resp: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}/{}", self.config.base_url, service, method);
        tracing::info!("Making Connect RPC call: {} {}", service, method);
        tracing::debug!("Connect RPC URL: {}", url);
        
        let mut req_builder = self.client.post(&url);
        
        // Add Connect protocol headers
        req_builder = req_builder
            .header("connect-protocol-version", "1");
            
        if self.config.use_json {
            req_builder = req_builder
                .header("content-type", "application/json")
                .json(request);
        } else {
            // TODO: Implement protobuf encoding
            return Err(ConnectError::InvalidResponse("Protobuf encoding not yet implemented".to_string()));
        }
        
        let response = req_builder.send().await?;
        tracing::debug!("Connect RPC response status: {}", response.status());
        
        let result = self.handle_unary_response(response).await;
        match &result {
            Ok(_) => tracing::debug!("Connect RPC call successful"),
            Err(e) => tracing::error!("Connect RPC call failed: {}", e),
        }
        result
    }
    
    /// Make a streaming Connect RPC call
    pub async fn call_streaming<Req>(
        &self,
        service: &str,
        method: &str,
        request: &Req,
    ) -> ConnectResult<ConnectStream>
    where
        Req: Serialize,
    {
        let url = format!("{}{}/{}", self.config.base_url, service, method);
        tracing::info!("Making Connect RPC streaming call: {} {}", service, method);
        tracing::info!("Request body is ready. req={}", serde_json::to_string_pretty(request)?);
        tracing::debug!("Connect RPC streaming URL: {}", url);
        
        let mut req_builder = self.client.post(&url);
        
        // Add Connect protocol headers for streaming like Python SDK
        req_builder = req_builder
            .header("connect-protocol-version", "1")
            .header("connect-keepalive-ping", "30"); // 30 second keepalive
            
        if self.config.use_json {
            // For Connect RPC streaming, we need to wrap the JSON in an envelope
            let json_body = serde_json::to_vec(request)?;
            let envelope = self.create_request_envelope(&json_body)?;
            
            req_builder = req_builder
                .header("content-type", "application/connect+json")
                .body(envelope);
        } else {
            // TODO: Implement protobuf encoding
            return Err(ConnectError::InvalidResponse("Protobuf encoding not yet implemented".to_string()));
        }
        
        tracing::debug!("About to send request with headers: Authorization={}, content-type=application/connect+json, connect-protocol-version=1", 
                       self.config.headers.get("Authorization").unwrap_or(&"<none>".to_string()));
        let response = req_builder.send().await?;
        let status = response.status();
        tracing::debug!("Connect RPC streaming response received. response={:#?}", response);
        
        
        if !status.is_success() {
            let error_body = response.text().await?;
            tracing::error!("Connect RPC streaming failed: HTTP {}: {}", status.as_u16(), error_body);
            return Err(ConnectError::Rpc {
                code: status.as_u16() as i32,
                message: format!("HTTP {}: {}", status.as_u16(), error_body),
            });
        }
        
        tracing::info!("Connect RPC streaming established successfully");
        Ok(ConnectStream::new(response))
    }
    
    /// Handle a unary Connect RPC response
    async fn handle_unary_response<Resp>(&self, response: Response) -> ConnectResult<Resp>
    where
        Resp: for<'de> Deserialize<'de>,
    {
        let status = response.status();
        
        if status.is_success() {
            // Success response
            if self.config.use_json {
                let resp: Resp = response.json().await?;
                Ok(resp)
            } else {
                // TODO: Handle protobuf response
                Err(ConnectError::InvalidResponse("Protobuf decoding not yet implemented".to_string()))
            }
        } else {
            // Error response - parse Connect error format
            let error_body = response.text().await?;
            
            // Try to parse as Connect error JSON
            if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_body) {
                let code = error_json.get("code")
                    .and_then(|c| c.as_i64())
                    .unwrap_or(status.as_u16() as i64) as i32;
                    
                let message = error_json.get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                    
                Err(ConnectError::Rpc { code, message })
            } else {
                // Fallback to HTTP status
                Err(ConnectError::Rpc {
                    code: status.as_u16() as i32,
                    message: format!("HTTP {}: {}", status.as_u16(), error_body),
                })
            }
        }
    }
}

/// Connect RPC streaming envelope flags
pub mod envelope_flags {
    pub const COMPRESSED: u8 = 0x01;
    pub const END_STREAM: u8 = 0x02;
}

/// Connect RPC streaming envelope for handling streaming responses
#[derive(Debug)]
pub struct StreamingEnvelope {
    pub flags: u8,
    pub data_length: u32,
    pub data: Vec<u8>,
}

impl StreamingEnvelope {
    pub fn is_compressed(&self) -> bool {
        (self.flags & envelope_flags::COMPRESSED) != 0
    }
    
    pub fn is_end_stream(&self) -> bool {
        (self.flags & envelope_flags::END_STREAM) != 0
    }
    
    pub fn decode_json<T>(&self) -> ConnectResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let data = if self.is_compressed() {
            // TODO: Implement gzip decompression
            return Err(ConnectError::InvalidResponse("Compression not yet supported".to_string()));
        } else {
            &self.data
        };
        
        serde_json::from_slice(data).map_err(ConnectError::Json)
    }
}

/// Stream parser for Connect streaming envelopes
pub struct StreamParser {
    buffer: Vec<u8>,
}

impl StreamParser {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
        }
    }
    
    pub fn add_chunk(&mut self, chunk: &[u8]) {
        self.buffer.extend_from_slice(chunk);
    }
    
    pub fn parse_envelopes(&mut self) -> ConnectResult<Vec<StreamingEnvelope>> {
        let mut envelopes = Vec::new();
        
        while self.buffer.len() >= 5 {  // Header size: 1 byte flags + 4 bytes length
            let flags = self.buffer[0];
            // Connect RPC uses big-endian for length field (both request and response)
            let data_length = u32::from_be_bytes([
                self.buffer[1],
                self.buffer[2], 
                self.buffer[3],
                self.buffer[4],
            ]);
            
            let total_message_size = 5 + data_length as usize;
            
            if self.buffer.len() < total_message_size {
                // Need more data
                break;
            }
            
            let data = self.buffer[5..total_message_size].to_vec();
            self.buffer.drain(0..total_message_size);
            
            envelopes.push(StreamingEnvelope {
                flags,
                data_length,
                data,
            });
            
            // If this is an end stream envelope, stop parsing
            if (flags & envelope_flags::END_STREAM) != 0 {
                break;
            }
        }
        
        Ok(envelopes)
    }
}

/// Connect streaming response wrapper
pub struct ConnectStream {
    response: Response,
    parser: StreamParser,
    finished: bool,
}

impl ConnectStream {
    pub fn new(response: Response) -> Self {
        Self {
            response,
            parser: StreamParser::new(),
            finished: false,
        }
    }
    
    /// Read the next envelope from the stream
    pub async fn next_envelope(&mut self) -> ConnectResult<Option<StreamingEnvelope>> {
        if self.finished {
            tracing::debug!("Stream already finished");
            return Ok(None);
        }
        
        loop {
            // Try to parse any complete envelopes from current buffer
            let envelopes = self.parser.parse_envelopes()?;
            
            if let Some(envelope) = envelopes.into_iter().next() {
                tracing::debug!("Parsed envelope: flags={:02x}, length={}, end_stream={}", 
                               envelope.flags, envelope.data_length, envelope.is_end_stream());
                if envelope.is_end_stream() {
                    tracing::debug!("Received end stream envelope");
                    self.finished = true;
                } else {
                    tracing::debug!("Received data envelope: {} bytes", envelope.data.len());
                }
                return Ok(Some(envelope));
            }
            
            // Need more data - read next chunk
            match self.response.chunk().await? {
                Some(chunk) => {
                    tracing::debug!("Received chunk: {} bytes", chunk.len());
                    
                    // Log the chunk contents as hex dump for debugging
                    let hex_dump: String = chunk.iter()
                        .enumerate()
                        .map(|(i, b)| if i % 16 == 0 { format!("\n  {:04x}: {:02x}", i, b) } else { format!(" {:02x}", b) })
                        .collect();
                    tracing::debug!("Chunk hex dump: {}", hex_dump);
                    
                    // Try to decode as text if it looks printable
                    if let Ok(text) = String::from_utf8(chunk.to_vec()) {
                        if text.chars().all(|c| c.is_ascii_graphic() || c.is_whitespace()) {
                            tracing::debug!("Chunk as text: {}", text);
                        }
                    }
                    
                    self.parser.add_chunk(&chunk);
                }
                None => {
                    // Stream ended without proper end envelope
                    tracing::warn!("Stream ended without proper end envelope (no chunks received)");
                    self.finished = true;
                    return Ok(None);
                }
            }
        }
    }
    
    /// Decode the next message of the specified type
    pub async fn next_message<T>(&mut self) -> ConnectResult<Option<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        if let Some(envelope) = self.next_envelope().await? {
            if envelope.is_end_stream() {
                // Check for error in end stream envelope
                if !envelope.data.is_empty() {
                    tracing::debug!("End stream envelope contains data: {} bytes", envelope.data.len());
                    let data_str = String::from_utf8_lossy(&envelope.data);
                    tracing::debug!("End stream envelope data: {}", data_str);
                    let error_data: serde_json::Value = envelope.decode_json()?;
                    if let Some(error) = error_data.get("error") {
                        return Err(ConnectError::Rpc {
                            code: error.get("code").and_then(|c| c.as_i64()).unwrap_or(0) as i32,
                            message: error.get("message").and_then(|m| m.as_str()).unwrap_or("Stream error").to_string(),
                        });
                    }
                } else {
                    tracing::debug!("End stream envelope is empty");
                }
                return Ok(None);
            }
            
            tracing::debug!("Received data envelope: {} bytes", envelope.data.len());
            let data_str = String::from_utf8_lossy(&envelope.data);
            tracing::debug!("Data envelope content: {}", data_str);
            let message: T = envelope.decode_json()?;
            Ok(Some(message))
        } else {
            Ok(None)
        }
    }
}

/// Connect filesystem client using Connect RPC protocol
#[derive(Clone)]
pub struct ConnectFilesystemClient {
    client: ConnectClient,
}

impl ConnectFilesystemClient {
    /// Create a new Connect filesystem client
    pub fn new(config: ConnectConfig) -> ConnectResult<Self> {
        let client = ConnectClient::new(config)?;
        Ok(Self { client })
    }
    
    /// List directory contents
    pub async fn list_dir(
        &self,
        request: &crate::filesystem::ListDirRequest,
    ) -> ConnectResult<crate::filesystem::ListDirResponse> {
        let json_req: crate::json_types::ListDirRequest = request.clone().into();
        let json_resp: crate::json_types::ListDirResponse = self.client.call_unary(
            "filesystem.Filesystem",
            "ListDir", 
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Get file/directory statistics
    pub async fn stat(
        &self,
        request: &crate::filesystem::StatRequest,
    ) -> ConnectResult<crate::filesystem::StatResponse> {
        let json_req: crate::json_types::StatRequest = request.clone().into();
        let json_resp: crate::json_types::StatResponse = self.client.call_unary(
            "filesystem.Filesystem",
            "Stat",
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Create directory
    pub async fn make_dir(
        &self,
        request: &crate::filesystem::MakeDirRequest,
    ) -> ConnectResult<crate::filesystem::MakeDirResponse> {
        let json_req: crate::json_types::MakeDirRequest = request.clone().into();
        let json_resp: crate::json_types::MakeDirResponse = self.client.call_unary(
            "filesystem.Filesystem",
            "MakeDir",
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Move/rename file or directory
    pub async fn move_entry(
        &self,
        request: &crate::filesystem::MoveRequest,
    ) -> ConnectResult<crate::filesystem::MoveResponse> {
        let json_req: crate::json_types::MoveRequest = request.clone().into();
        let json_resp: crate::json_types::MoveResponse = self.client.call_unary(
            "filesystem.Filesystem",
            "Move",
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Remove file or directory
    pub async fn remove(
        &self,
        request: &crate::filesystem::RemoveRequest,
    ) -> ConnectResult<crate::filesystem::RemoveResponse> {
        let json_req: crate::json_types::RemoveRequest = request.clone().into();
        let json_resp: crate::json_types::RemoveResponse = self.client.call_unary(
            "filesystem.Filesystem",
            "Remove",
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Watch directory for filesystem events (streaming)
    pub async fn watch_dir(
        &self,
        request: &crate::filesystem::WatchDirRequest,
    ) -> ConnectResult<ConnectStream> {
        let json_req = crate::json_types::WatchDirRequest {
            path: request.path.clone(),
            recursive: request.recursive,
        };
        
        self.client.call_streaming(
            "filesystem.Filesystem",
            "WatchDir",
            &json_req
        ).await
    }
}

/// Connect process client using Connect RPC protocol
#[derive(Clone)]
pub struct ConnectProcessClient {
    client: ConnectClient,
}

impl ConnectProcessClient {
    /// Create a new Connect process client
    pub fn new(config: ConnectConfig) -> ConnectResult<Self> {
        let client = ConnectClient::new(config)?;
        Ok(Self { client })
    }
    
    /// List running processes
    pub async fn list(
        &self,
        request: &crate::process::ListRequest,
    ) -> ConnectResult<crate::process::ListResponse> {
        let json_req: crate::json_types::ListRequest = request.clone().into();
        let json_resp: crate::json_types::ListResponse = self.client.call_unary(
            "process.Process",
            "List",
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Send signal to process
    pub async fn send_signal(
        &self,
        request: &crate::process::SendSignalRequest,
    ) -> ConnectResult<crate::process::SendSignalResponse> {
        let json_req: crate::json_types::SendSignalRequest = request.clone().into();
        let json_resp: crate::json_types::SendSignalResponse = self.client.call_unary(
            "process.Process",
            "SendSignal",
            &json_req
        ).await?;
        Ok(json_resp.into())
    }
    
    /// Start a process and stream its output
    pub async fn start(
        &self,
        request: &crate::json_types::StartRequest,
    ) -> ConnectResult<ConnectStream> {
        self.client.call_streaming(
            "process.Process",
            "Start",
            request
        ).await
    }
    
    /// Connect to an existing process and stream its output  
    pub async fn connect(
        &self,
        _request: &crate::process::ConnectRequest,
    ) -> ConnectResult<ConnectStream> {
        // Convert to JSON request - simplified for now
        let json_req = serde_json::json!({
            "process": {
                "selector": {
                    "pid": 0  // TODO: Extract from request.process
                }
            }
        });
        
        self.client.call_streaming(
            "process.Process", 
            "Connect",
            &json_req
        ).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_connect_config_default() {
        let config = ConnectConfig::default();
        assert_eq!(config.timeout_secs, 30);
        assert!(config.use_json);
        assert!(config.headers.is_empty());
    }
    
    #[test]
    fn test_connect_client_creation() {
        let config = ConnectConfig {
            base_url: "https://example.com".to_string(),
            ..Default::default()
        };
        
        let client = ConnectClient::new(config);
        assert!(client.is_ok());
    }
}