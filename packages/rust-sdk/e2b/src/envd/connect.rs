//! Connect RPC client implementation for E2B envd service
//!
//! This module provides a Connect RPC client that matches the protocol
//! used by the Python SDK, using HTTP/1.1 + JSON instead of traditional gRPC.

use crate::commands::{AsyncCommandHandle, AsyncCommands, CommandResult, ProcessInfo};
use crate::error::{Error, Result};
use base64::prelude::*;
use crate::filesystem::{
    AsyncFilesystem, AsyncWatchHandle, EntryInfo, FilesystemEvent, WriteEntry, FileType as DomainFileType,
};
use crate::pty::{AsyncPty, AsyncPtyHandle, PtySize};
use e2b_connect::connect::{ConnectConfig, ConnectFilesystemClient, ConnectProcessClient, ConnectError};
use e2b_connect::filesystem::{ListDirRequest, StatRequest, MakeDirRequest, RemoveRequest, MoveRequest, FileType};
use e2b_connect::process::{ListRequest as ProcessListRequest, SendSignalRequest, ProcessSelector, process_selector, Signal};
use reqwest::multipart;
use std::collections::HashMap;
use std::pin::Pin;

/// Connect RPC client for E2B envd service
#[derive(Clone)]
pub struct ConnectRpcClient {
    envd_client: super::EnvdClient,
    username: String,
    filesystem_client: Option<ConnectFilesystemClient>,
    process_client: Option<ConnectProcessClient>,
}

impl ConnectRpcClient {
    /// Create a new Connect RPC client
    pub fn new(envd_client: super::EnvdClient) -> Self {
        Self {
            envd_client,
            username: "user".to_string(),
            filesystem_client: None,
            process_client: None,
        }
    }

    /// Set the username for operations
    pub fn with_username(mut self, username: String) -> Self {
        self.username = username;
        self
    }

    /// Configure Connect RPC endpoint
    pub fn with_connect_endpoint(mut self, endpoint: &str) -> Result<Self> {
        tracing::info!("Configuring Connect RPC endpoint: {}", endpoint);
        
        let mut headers = std::collections::HashMap::new();
        
        // Add authentication headers - Connect RPC uses Basic auth with username:password format
        // where username is "user" and password is empty, following Python SDK pattern
        let auth_string = format!("{}:", self.username);
        let auth_encoded = BASE64_STANDARD.encode(auth_string.as_bytes());
        let auth_header = format!("Basic {}", auth_encoded);
        headers.insert("Authorization".to_string(), auth_header.clone());
        tracing::debug!("Adding Connect RPC Basic auth for user: {} -> {}", self.username, auth_header);
        
        let config = ConnectConfig {
            base_url: endpoint.to_string(),
            use_json: true, // Use JSON like Python SDK
            headers,
            ..Default::default()
        };
        
        tracing::debug!("Connect config: base_url={}, use_json={}, headers_count={}", 
                       config.base_url, config.use_json, config.headers.len());
        
        self.filesystem_client = Some(
            ConnectFilesystemClient::new(config.clone())
                .map_err(|e| {
                    tracing::error!("Failed to create filesystem client: {}", e);
                    Error::other(format!("Failed to create filesystem client: {}", e))
                })?
        );
        
        self.process_client = Some(
            ConnectProcessClient::new(config)
                .map_err(|e| {
                    tracing::error!("Failed to create process client: {}", e);
                    Error::other(format!("Failed to create process client: {}", e))
                })?
        );
        
        tracing::info!("Connect RPC client configured successfully");
        Ok(self)
    }

    /// Get the filesystem client
    fn get_filesystem_client(&self) -> Result<&ConnectFilesystemClient> {
        self.filesystem_client.as_ref()
            .ok_or_else(|| Error::other("Filesystem client not initialized. Call with_connect_endpoint first."))
    }

    /// Get the process client
    fn get_process_client(&self) -> Result<&ConnectProcessClient> {
        self.process_client.as_ref()
            .ok_or_else(|| Error::other("Process client not initialized. Call with_connect_endpoint first."))
    }

    /// Map Connect error to domain error
    fn map_connect_error(err: ConnectError) -> Error {
        match err {
            ConnectError::Http(e) => Error::other(format!("HTTP error: {}", e)),
            ConnectError::Json(e) => Error::other(format!("JSON error: {}", e)),
            ConnectError::Rpc { code, message } => {
                match code {
                    400 => Error::invalid_argument(&message),
                    401 => Error::authentication(&message),
                    404 => Error::not_found(&message),
                    429 => Error::other(format!("Rate limited: {}", message)),
                    502 => Error::timeout(&message),
                    507 => Error::not_enough_space(&message),
                    _ => Error::other(format!("RPC error {}: {}", code, message)),
                }
            }
            ConnectError::InvalidResponse(e) => Error::other(format!("Invalid response: {}", e)),
        }
    }

    /// Get Connect endpoint for sandbox
    pub fn get_connect_endpoint(sandbox_id: &str, domain: Option<&str>, debug: bool) -> String {
        if debug {
            "http://localhost:49983".to_string()
        } else {
            let domain = domain.unwrap_or("e2b.app");
            format!("https://49983-{}.{}", sandbox_id, domain)
        }
    }
    
    /// Helper method to execute a process stream and collect results
    async fn execute_process_stream(
        &self,
        client: &ConnectProcessClient,
        request: e2b_connect::json_types::StartRequest,
    ) -> Result<CommandResult> {
        let mut connect_stream = client.start(&request).await
            .map_err(Self::map_connect_error)?;
            
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut _exit_code = 0;
        let mut error: Option<String> = None;
        
        while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::StartResponse>().await {
            tracing::debug!("Received process response: {:?}", response);
            let event = response.event;
            if let Some(data) = event.data {
                if let Some(pty) = data.pty {}
                if let Some(bytes) = data.stdout {
                    if let Ok(s) = String::from_utf8(bytes) {
                        stdout.push_str(&s);
                    }
                }
                if let Some(bytes) = data.stderr {
                    if let Ok(s) = String::from_utf8(bytes) {
                        stderr.push_str(&s);
                    }
                }
            }
            if let Some(end) = event.end {
                _exit_code = end.exit_code;
                error = end.error;
                break;
            }
        }
        
        Ok(CommandResult {
            stdout,
            stderr,
            exit_code: _exit_code,
            error,
        })
    }
}

#[async_trait::async_trait]
impl AsyncFilesystem for ConnectRpcClient {
    async fn list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        let client = self.get_filesystem_client()?;
        
        let request = ListDirRequest {
            path: path.to_string(),
            depth: 1, // List direct children only
        };
        
        let response = client.list_dir(&request).await
            .map_err(Self::map_connect_error)?;
            
        let mut result = Vec::new();
        for entry in response.entries {
            let file_type = match entry.r#type {
                t if t == FileType::Directory as i32 => Some(DomainFileType::Dir),
                t if t == FileType::File as i32 => Some(DomainFileType::File),
                _ => None,
            };
            
            result.push(EntryInfo {
                name: entry.name,
                r#type: file_type,
                path: entry.path,
            });
        }
        
        Ok(result)
    }

    async fn read(&self, path: &str) -> Result<Vec<u8>> {
        let url = format!("{}{}", self.envd_client.base_url, super::ENVD_API_FILES_ROUTE);

        let response = self
            .envd_client
            .client
            .get(&url)
            .query(&[("path", path), ("username", &self.username)])
            .send()
            .await?;

        if response.status().is_success() {
            let bytes = response.bytes().await?;
            Ok(bytes.to_vec())
        } else {
            let status = response.status();
            let message = response.text().await.unwrap_or_default();
            Err(self.envd_client.handle_error(status, &message))
        }
    }

    async fn write(&self, path: &str, data: &[u8]) -> Result<()> {
        // Use HTTP API for file writing (same as before)
        let url = format!("{}{}", self.envd_client.base_url, super::ENVD_API_FILES_ROUTE);

        let form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(data.to_vec()).file_name(path.to_string()),
            )
            .text("username", self.username.clone())
            .text("path", path.to_string());

        let response = self
            .envd_client
            .client
            .post(&url)
            .multipart(form)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let message = response.text().await.unwrap_or_default();
            Err(self.envd_client.handle_error(status, &message))
        }
    }

    async fn write_multiple(&self, entries: &[WriteEntry]) -> Result<()> {
        // Use HTTP API for multiple file writing (same as before)
        let url = format!("{}{}", self.envd_client.base_url, super::ENVD_API_FILES_ROUTE);

        let mut form = multipart::Form::new().text("username", self.username.clone());

        for entry in entries {
            form = form.part(
                "file",
                multipart::Part::bytes(entry.data.clone()).file_name(entry.path.clone()),
            );
        }

        let response = self
            .envd_client
            .client
            .post(&url)
            .multipart(form)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let message = response.text().await.unwrap_or_default();
            Err(self.envd_client.handle_error(status, &message))
        }
    }

    async fn remove(&self, path: &str) -> Result<()> {
        let client = self.get_filesystem_client()?;
        
        let request = RemoveRequest {
            path: path.to_string(),
        };
        
        client.remove(&request).await
            .map_err(Self::map_connect_error)?;
            
        Ok(())
    }

    async fn make_dir(&self, path: &str) -> Result<()> {
        let client = self.get_filesystem_client()?;
        
        let request = MakeDirRequest {
            path: path.to_string(),
        };
        
        client.make_dir(&request).await
            .map_err(Self::map_connect_error)?;
            
        Ok(())
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        let client = self.get_filesystem_client()?;
        
        let request = StatRequest {
            path: path.to_string(),
        };
        
        match client.stat(&request).await {
            Ok(response) => Ok(response.entry.is_some()),
            Err(ConnectError::Rpc { code: 404, .. }) => Ok(false), // Not found
            Err(e) => Err(Self::map_connect_error(e)),
        }
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        let client = self.get_filesystem_client()?;
        
        let request = MoveRequest {
            source: old_path.to_string(),
            destination: new_path.to_string(),
        };
        
        client.move_entry(&request).await
            .map_err(Self::map_connect_error)?;
            
        Ok(())
    }

    async fn watch(&self, path: &str) -> Result<AsyncWatchHandle> {
        let client = self.get_filesystem_client()?;
        
        let request = e2b_connect::filesystem::WatchDirRequest {
            path: path.to_string(),
            recursive: false, // Default to non-recursive
        };
        
        let mut connect_stream = client.watch_dir(&request).await
            .map_err(Self::map_connect_error)?;
            
        // Create async stream that processes Connect envelopes
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        
        tokio::spawn(async move {
            use crate::filesystem::FilesystemEventType;
            
            while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::WatchDirResponse>().await {
                if let Some(event) = response.event {
                    match event {
                        e2b_connect::json_types::WatchEvent::Filesystem { filesystem } => {
                            let event_type = match filesystem.r#type {
                                1 => FilesystemEventType::Create,
                                2 => FilesystemEventType::Write,
                                3 => FilesystemEventType::Remove,
                                4 => FilesystemEventType::Rename,
                                5 => FilesystemEventType::Chmod,
                                _ => FilesystemEventType::Write, // Default fallback
                            };
                            
                            let fs_event = FilesystemEvent {
                                name: filesystem.name,
                                r#type: event_type,
                            };
                            
                            if tx.send(Ok(fs_event)).is_err() {
                                break; // Receiver dropped
                            }
                        }
                        _ => {
                            // Skip start and keepalive events
                        }
                    }
                }
            }
        });
        
        let stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx);
        let boxed_stream = Box::pin(stream) as Pin<Box<dyn futures::Stream<Item = Result<FilesystemEvent>> + Send>>;
        Ok(AsyncWatchHandle::new(boxed_stream))
    }
}

#[async_trait::async_trait]
impl AsyncCommands for ConnectRpcClient {
    async fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
        tracing::info!("Running command: {} {:?}", cmd, args);
        let client = self.get_process_client()?;
        
        // Build full command string like Python SDK
        let full_cmd = if args.is_empty() {
            cmd.to_string()
        } else {
            format!("{} {}", cmd, args.join(" "))
        };
        
        let mut envs = HashMap::new();
        envs.insert("DISPLAY".to_string(), ":1".to_string());

        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: "/bin/bash".to_string(),
                args: vec!["-l".to_string(), "-c".to_string(), full_cmd],
                envs: envs,
                cwd: None,
            },
            pty: None,
            tag: None,
        };
        
        let mut connect_stream = client.start(&request).await
            .map_err(Self::map_connect_error)?;
        
        tracing::debug!("Started command streaming, waiting for output. request={:#?}", request);
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut _exit_code = 0;
        let mut error: Option<String> = None;
        
        while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::StartResponse>().await {
            tracing::debug!("Received process response: {:?}", response);
            let event = response.event;
            if let Some(data) = event.data {
                if let Some(bytes) = data.stdout {
                    if let Ok(s) = String::from_utf8(bytes) {
                        tracing::debug!("Stdout received. stdout={}", s);
                        stdout.push_str(&s);
                    }
                }
                if let Some(bytes) = data.stderr {
                    if let Ok(s) = String::from_utf8(bytes) {
                        tracing::debug!("Stderr received. stderr={}", s);
                        stderr.push_str(&s);
                    }
                }
                if let Some(pty) = data.pty {
                    if let Ok(s) = String::from_utf8(pty) {
                        tracing::debug!("pty received. pty={}", s);
                    }
                }
            }

            if let Some(end) = event.end {
                _exit_code = end.exit_code;
                error = end.error;
                break;
            }
        }
        
        Ok(CommandResult {
            stdout,
            stderr,
            exit_code: _exit_code,
            error,
        })
    }

    async fn run_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<CommandResult> {
        let client = self.get_process_client()?;
        
        // Build full command string like Python SDK
        let full_cmd = if args.is_empty() {
            cmd.to_string()
        } else {
            format!("{} {}", cmd, args.join(" "))
        };
        
        // Use bash wrapper like Python SDK: /bin/bash -l -c "command"
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: "/bin/bash".to_string(),
                args: vec!["-l".to_string(), "-c".to_string(), full_cmd],
                envs: env.clone(),
                cwd: None,
            },
            pty: None,
            tag: None,
        };
        
        self.execute_process_stream(client, request).await
    }

    async fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult> {
        let client = self.get_process_client()?;
        
        // Build full command string like Python SDK
        let full_cmd = if args.is_empty() {
            cmd.to_string()
        } else {
            format!("{} {}", cmd, args.join(" "))
        };
        
        // Use bash wrapper like Python SDK: /bin/bash -l -c "command"
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: "/bin/bash".to_string(),
                args: vec!["-l".to_string(), "-c".to_string(), full_cmd],
                envs: HashMap::new(),
                cwd: Some(cwd.to_string()),
            },
            pty: None,
            tag: None,
        };
        
        self.execute_process_stream(client, request).await
    }

    async fn run_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        _timeout: Option<std::time::Duration>,
    ) -> Result<CommandResult> {
        let client = self.get_process_client()?;
        
        // Build full command string like Python SDK
        let full_cmd = if args.is_empty() {
            cmd.to_string()
        } else {
            format!("{} {}", cmd, args.join(" "))
        };
        
        // Use bash wrapper like Python SDK: /bin/bash -l -c "command"
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: "/bin/bash".to_string(),
                args: vec!["-l".to_string(), "-c".to_string(), full_cmd],
                envs: env.cloned().unwrap_or_default(),
                cwd: cwd.map(|s| s.to_string()),
            },
            pty: None,
            tag: None,
        };
        
        self.execute_process_stream(client, request).await
    }

    async fn start(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle> {
        self.start_with_options(cmd, args, None, None).await
    }

    async fn start_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        _env: &HashMap<String, String>,
    ) -> Result<AsyncCommandHandle> {
        self.start(cmd, args).await
    }

    async fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<AsyncCommandHandle> {
        tracing::info!("Starting async command: {} {:?} (env={}, cwd={:?})", 
                      cmd, args, env.is_some(), cwd);
        let client = self.get_process_client()?;
        
        // Build full command string like Python SDK
        let full_cmd = if args.is_empty() {
            cmd.to_string()
        } else {
            format!("{} {}", cmd, args.join(" "))
        };
        
        // Use bash wrapper like Python SDK: /bin/bash -l -c "command"
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: "/bin/bash".to_string(),
                args: vec!["-l".to_string(), "-c".to_string(), full_cmd],
                envs: env.cloned().unwrap_or_default(),
                cwd: cwd.map(|s| s.to_string()),
            },
            pty: None,
            tag: None,
        };
        
        let mut connect_stream = client.start(&request).await
            .map_err(Self::map_connect_error)?;
            
        use tokio::sync::{mpsc, oneshot};
        let (stdout_tx, stdout_rx) = mpsc::unbounded_channel();
        let (stderr_tx, stderr_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = oneshot::channel();
        
        // Generate unique PID for this command
        let pid = rand::random::<u32>() as i32;
        
        // Spawn task to handle streaming output
        tokio::spawn(async move {
            let mut final_result = CommandResult {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                error: None,
            };
            
            while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::StartResponse>().await {
                let event = response.event;
                if let Some(data) = event.data {
                    if let Some(bytes) = data.stdout {
                        if let Ok(s) = String::from_utf8(bytes) {
                            final_result.stdout.push_str(&s);
                            let _ = stdout_tx.send(s);
                        }
                    }
                    if let Some(bytes) = data.stderr {
                        if let Ok(s) = String::from_utf8(bytes) {
                            final_result.stderr.push_str(&s);
                            let _ = stderr_tx.send(s);
                        }
                    }
                }
                if let Some(end) = event.end {
                    final_result.exit_code = end.exit_code;
                    final_result.error = end.error;
                    let _ = exit_tx.send(final_result);
                    break;
                }
            }
        });
        
        Ok(AsyncCommandHandle::new(pid, stdout_rx, stderr_rx, exit_rx))
    }

    async fn list(&self) -> Result<Vec<ProcessInfo>> {
        let client = self.get_process_client()?;
        
        let request = ProcessListRequest {};
        let response = client.list(&request).await
            .map_err(Self::map_connect_error)?;
            
        Ok(response.processes.into_iter().map(|p| ProcessInfo {
            pid: p.pid as i32,
            tag: p.tag,
            cmd: p.config.as_ref().map(|c| c.cmd.clone()).unwrap_or_default(),
            args: p.config.as_ref().map(|c| c.args.clone()).unwrap_or_default(),
            envs: p.config.as_ref().map(|c| c.envs.clone()).unwrap_or_default(),
            cwd: p.config.as_ref().and_then(|c| c.cwd.clone()),
        }).collect())
    }

    async fn kill(&self, pid: i32) -> Result<()> {
        let client = self.get_process_client()?;
        
        let selector = ProcessSelector {
            selector: Some(process_selector::Selector::Pid(pid as u32)),
        };
        
        let request = SendSignalRequest {
            process: Some(selector),
            signal: Signal::Sigkill as i32,
        };
        
        client.send_signal(&request).await
            .map_err(Self::map_connect_error)?;
            
        Ok(())
    }
}

#[async_trait::async_trait]
impl AsyncPty for ConnectRpcClient {
    async fn create(&self, cmd: &str, args: &[&str]) -> Result<AsyncPtyHandle> {
        let client = self.get_process_client()?;
        
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: cmd.to_string(),
                args: args.iter().map(|s| s.to_string()).collect(),
                envs: std::collections::HashMap::new(),
                cwd: None,
            },
            pty: Some(e2b_connect::json_types::Pty {
                size: Some(e2b_connect::json_types::PtySize {
                    cols: 80,
                    rows: 24,
                }),
            }),
            tag: None,
        };
        
        let mut connect_stream = client.start(&request).await
            .map_err(Self::map_connect_error)?;
            
        use tokio::sync::{mpsc, oneshot};
        let (output_tx, output_rx) = mpsc::unbounded_channel::<crate::pty::PtyOutput>();
        let (exit_tx, exit_rx) = oneshot::channel();
        
        let pty_id = uuid::Uuid::new_v4().to_string();
        let pid = rand::random::<u32>() as i32;
        
        // Spawn task to handle PTY streaming output
        tokio::spawn(async move {
            let mut _exit_code = 0;
            
            while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::StartResponse>().await {
                let event = response.event;
                if let Some(data) = event.data {
                    if let Some(bytes) = data.pty {
                        let _ = output_tx.send(bytes);
                    }
                    if let Some(bytes) = data.stdout {
                        let _ = output_tx.send(bytes);
                    }
                }
                if let Some(end) = event.end {
                    _exit_code = end.exit_code;
                    let _ = exit_tx.send(_exit_code);
                    break;
                }
            }
        });
        
        Ok(AsyncPtyHandle::new(pid, pty_id, output_rx, exit_rx))
    }

    async fn create_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<AsyncPtyHandle> {
        let client = self.get_process_client()?;
        
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: cmd.to_string(),
                args: args.iter().map(|s| s.to_string()).collect(),
                envs: env.clone(),
                cwd: None,
            },
            pty: Some(e2b_connect::json_types::Pty {
                size: Some(e2b_connect::json_types::PtySize {
                    cols: 80,
                    rows: 24,
                }),
            }),
            tag: None,
        };
        
        let mut connect_stream = client.start(&request).await
            .map_err(Self::map_connect_error)?;
            
        use tokio::sync::{mpsc, oneshot};
        let (output_tx, output_rx) = mpsc::unbounded_channel::<crate::pty::PtyOutput>();
        let (exit_tx, exit_rx) = oneshot::channel();
        
        let pty_id = uuid::Uuid::new_v4().to_string();
        let pid = rand::random::<u32>() as i32;
        
        // Spawn task to handle PTY streaming output
        tokio::spawn(async move {
            let mut _exit_code = 0;
            
            while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::StartResponse>().await {
                let event = response.event;
                if let Some(data) = event.data {
                    if let Some(bytes) = data.pty {
                        let _ = output_tx.send(bytes);
                    }
                    if let Some(bytes) = data.stdout {
                        let _ = output_tx.send(bytes);
                    }
                }
                if let Some(end) = event.end {
                    _exit_code = end.exit_code;
                    let _ = exit_tx.send(_exit_code);
                    break;
                }
            }
        });
        
        Ok(AsyncPtyHandle::new(pid, pty_id, output_rx, exit_rx))
    }

    async fn create_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        size: Option<PtySize>,
    ) -> Result<AsyncPtyHandle> {
        let client = self.get_process_client()?;
        
        let pty_size = size.map(|s| e2b_connect::json_types::PtySize {
            cols: s.cols,
            rows: s.rows,
        }).unwrap_or(e2b_connect::json_types::PtySize {
            cols: 80,
            rows: 24,
        });
        
        let request = e2b_connect::json_types::StartRequest {
            process: e2b_connect::json_types::ProcessConfig {
                cmd: cmd.to_string(),
                args: args.iter().map(|s| s.to_string()).collect(),
                envs: env.cloned().unwrap_or_default(),
                cwd: cwd.map(|s| s.to_string()),
            },
            pty: Some(e2b_connect::json_types::Pty {
                size: Some(pty_size),
            }),
            tag: None,
        };
        
        let mut connect_stream = client.start(&request).await
            .map_err(Self::map_connect_error)?;
            
        use tokio::sync::{mpsc, oneshot};
        let (output_tx, output_rx) = mpsc::unbounded_channel::<crate::pty::PtyOutput>();
        let (exit_tx, exit_rx) = oneshot::channel();
        
        let pty_id = uuid::Uuid::new_v4().to_string();
        let pid = rand::random::<u32>() as i32;
        
        // Spawn task to handle PTY streaming output
        tokio::spawn(async move {
            let mut _exit_code = 0;
            
            while let Ok(Some(response)) = connect_stream.next_message::<e2b_connect::json_types::StartResponse>().await {
                let event = response.event;
                if let Some(data) = event.data {
                    if let Some(bytes) = data.pty {
                        let _ = output_tx.send(bytes);
                    }
                    if let Some(bytes) = data.stdout {
                        let _ = output_tx.send(bytes);
                    }
                }
                if let Some(end) = event.end {
                    _exit_code = end.exit_code;
                    let _ = exit_tx.send(_exit_code);
                    break;
                }
            }
        });
        
        Ok(AsyncPtyHandle::new(pid, pty_id, output_rx, exit_rx))
    }

    async fn list(&self) -> Result<Vec<String>> {
        // Return empty list for now
        Ok(Vec::new())
    }

    async fn kill(&self, _pty_id: &str) -> Result<()> {
        // TODO: Implement PTY termination
        Ok(())
    }
}