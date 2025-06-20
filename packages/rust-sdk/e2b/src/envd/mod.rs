use crate::commands::{AsyncCommandHandle, AsyncCommands, CommandResult, ProcessInfo};
use crate::error::{Error, Result};
use crate::filesystem::{
    AsyncFilesystem, AsyncWatchHandle, EntryInfo, FilesystemEvent, WriteEntry,
};
use crate::pty::{AsyncPty, AsyncPtyHandle, PtySize};
use reqwest::{multipart, Client, StatusCode};
use std::collections::HashMap;

// Import RPC clients
use e2b_connect::filesystem::{filesystem_client::FilesystemClient, ListDirRequest, StatRequest, MakeDirRequest, 
    RemoveRequest, MoveRequest, WatchDirRequest};
use e2b_connect::process::process_client::ProcessClient;
use e2b_connect::process::{ProcessConfig, StartRequest};
use e2b_connect::process::process_event;
use tokio::sync::mpsc;
use e2b_connect::process::{Pty, pty};
use tonic::transport::Channel;
use std::sync::Arc;
use tokio::sync::Mutex;
use futures::StreamExt;
use std::pin::Pin;
use crate::filesystem::FilesystemEventType;
/// ENVD API routes
pub const ENVD_API_FILES_ROUTE: &str = "/files";
pub const ENVD_API_HEALTH_ROUTE: &str = "/health";

// Connect RPC implementation (HTTP-based, matches Python SDK)
pub mod connect;
pub use connect::ConnectRpcClient;

/// ENVD API client for sandbox operations
#[derive(Clone)]
pub struct EnvdClient {
    client: Client,
    base_url: String,
}

impl EnvdClient {
    pub fn new(client: Client, base_url: String) -> Self {
        Self { client, base_url }
    }

    /// Handle HTTP response errors and convert to domain errors
    fn handle_error(&self, status: StatusCode, message: &str) -> Error {
        match status {
            StatusCode::BAD_REQUEST => Error::invalid_argument(message),
            StatusCode::UNAUTHORIZED => Error::authentication(message),
            StatusCode::NOT_FOUND => Error::not_found(message),
            StatusCode::TOO_MANY_REQUESTS => {
                Error::other(format!("{}: The requests are being rate limited.", message))
            }
            StatusCode::BAD_GATEWAY => Error::timeout(message),
            StatusCode::INSUFFICIENT_STORAGE => Error::not_enough_space(message),
            _ => Error::other(format!("{}: {}", status.as_u16(), message)),
        }
    }

    /// Check if ENVD service is healthy
    pub async fn health_check(&self) -> Result<()> {
        let url = format!("{}{}", self.base_url, ENVD_API_HEALTH_ROUTE);
        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let message = response.text().await.unwrap_or_default();
            Err(self.handle_error(status, &message))
        }
    }
}

/// RPC client for real-time operations
pub struct RpcClient {
    envd_client: EnvdClient,
    username: String,
    filesystem_client: Option<Arc<Mutex<FilesystemClient<Channel>>>>,
    process_client: Option<Arc<Mutex<ProcessClient<Channel>>>>,
}

impl RpcClient {
    pub fn new(envd_client: EnvdClient) -> Self {
        Self {
            envd_client,
            username: "user".to_string(),
            filesystem_client: None,
            process_client: None,
        }
    }

    pub fn with_username(mut self, username: String) -> Self {
        self.username = username;
        self
    }

    pub async fn with_grpc_endpoint(mut self, endpoint: &str) -> Result<Self> {
        let channel = Channel::from_shared(endpoint.to_string())
            .map_err(|e| Error::other(format!("Invalid gRPC endpoint: {}", e)))?
            .connect()
            .await
            .map_err(|e| Error::other(format!("Failed to connect to gRPC: {}", e)))?;

        self.filesystem_client = Some(Arc::new(Mutex::new(FilesystemClient::new(channel.clone()))));
        self.process_client = Some(Arc::new(Mutex::new(ProcessClient::new(channel))));
        Ok(self)
    }

    fn get_filesystem_client(&self) -> Result<Arc<Mutex<FilesystemClient<Channel>>>> {
        self.filesystem_client.as_ref()
            .ok_or_else(|| Error::other("Filesystem client not initialized. Call with_grpc_endpoint first."))
            .map(|c| c.clone())
    }

    fn get_process_client(&self) -> Result<Arc<Mutex<ProcessClient<Channel>>>> {
        self.process_client.as_ref()
            .ok_or_else(|| Error::other("Process client not initialized. Call with_grpc_endpoint first."))
            .map(|c| c.clone())
    }
}

#[async_trait::async_trait]
impl AsyncFilesystem for RpcClient {
    async fn list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        let client = self.get_filesystem_client()?;
        let mut client = client.lock().await;
        
        let request = ListDirRequest {
            path: path.to_string(),
            depth: 1, // List direct children only
        };
        
        let response = client.list_dir(request).await
            .map_err(|e| Error::other(format!("gRPC list_dir failed: {}", e)))?;
            
        let entries = response.into_inner().entries;
        let mut result = Vec::new();
        
        for entry in entries {
            use crate::filesystem::FileType as DomainFileType;
            
            let file_type = match entry.r#type {
                t if t == e2b_connect::filesystem::FileType::Directory as i32 => Some(DomainFileType::Dir),
                t if t == e2b_connect::filesystem::FileType::File as i32 => Some(DomainFileType::File),
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
        let url = format!("{}{}", self.envd_client.base_url, ENVD_API_FILES_ROUTE);

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
        let url = format!("{}{}", self.envd_client.base_url, ENVD_API_FILES_ROUTE);

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
        let url = format!("{}{}", self.envd_client.base_url, ENVD_API_FILES_ROUTE);

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
        let mut client = client.lock().await;
        
        let request = RemoveRequest {
            path: path.to_string(),
        };
        
        client.remove(request).await
            .map_err(|e| Error::other(format!("gRPC remove failed: {}", e)))?;
            
        Ok(())
    }

    async fn make_dir(&self, path: &str) -> Result<()> {
        let client = self.get_filesystem_client()?;
        let mut client = client.lock().await;
        
        let request = MakeDirRequest {
            path: path.to_string(),
        };
        
        client.make_dir(request).await
            .map_err(|e| Error::other(format!("gRPC make_dir failed: {}", e)))?;
            
        Ok(())
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        let client = self.get_filesystem_client()?;
        let mut client = client.lock().await;
        
        let request = StatRequest {
            path: path.to_string(),
        };
        
        match client.stat(request).await {
            Ok(response) => Ok(response.into_inner().entry.is_some()),
            Err(status) => {
                // If the error is NOT_FOUND, the file doesn't exist
                if status.code() == tonic::Code::NotFound {
                    Ok(false)
                } else {
                    Err(Error::other(format!("gRPC stat failed: {}", status)))
                }
            }
        }
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        let client = self.get_filesystem_client()?;
        let mut client = client.lock().await;
        
        let request = MoveRequest {
            source: old_path.to_string(),
            destination: new_path.to_string(),
        };
        
        client.r#move(request).await
            .map_err(|e| Error::other(format!("gRPC move failed: {}", e)))?;
            
        Ok(())
    }

    async fn watch(&self, path: &str) -> Result<AsyncWatchHandle> {
        let client = self.get_filesystem_client()?;
        let mut client = client.lock().await;
        
        let request = WatchDirRequest {
            path: path.to_string(),
            recursive: false, // Default to non-recursive
        };
        
        let response_stream = client.watch_dir(request).await
            .map_err(|e| Error::other(format!("gRPC watch_dir failed: {}", e)))?
            .into_inner();
        
        
        let mapped_stream = response_stream.filter_map(move |result| async move {
            match result {
                Ok(response) => {
                    if let Some(event) = response.event {
                        match event {
                            e2b_connect::filesystem::watch_dir_response::Event::Filesystem(fs_event) => {
                                let event_type = match fs_event.r#type {
                                    t if t == e2b_connect::filesystem::EventType::Create as i32 => FilesystemEventType::Create,
                                    t if t == e2b_connect::filesystem::EventType::Write as i32 => FilesystemEventType::Write,
                                    t if t == e2b_connect::filesystem::EventType::Remove as i32 => FilesystemEventType::Remove,
                                    t if t == e2b_connect::filesystem::EventType::Rename as i32 => FilesystemEventType::Rename,
                                    t if t == e2b_connect::filesystem::EventType::Chmod as i32 => FilesystemEventType::Chmod,
                                    _ => FilesystemEventType::Write, // Default fallback
                                };
                                
                                Some(Ok(FilesystemEvent {
                                    name: fs_event.name,
                                    r#type: event_type,
                                }))
                            }
                            _ => {
                                // Skip start and keepalive events
                                None
                            }
                        }
                    } else {
                        Some(Err(Error::other("Empty watch response")))
                    }
                }
                Err(e) => Some(Err(Error::other(format!("Watch stream error: {}", e)))),
            }
        });
        
        let stream = Box::pin(mapped_stream)
            as Pin<Box<dyn futures::Stream<Item = Result<FilesystemEvent>> + Send>>;
        Ok(AsyncWatchHandle::new(stream))
    }
}

#[async_trait::async_trait]
impl AsyncCommands for RpcClient {
    async fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {

        let client = self.get_process_client()?;
        let mut client = client.lock().await;

        // Build ProcessConfig
        let config = ProcessConfig {
            cmd: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            envs: std::collections::HashMap::new(),
            cwd: None,
        };
        let request = StartRequest {
            process: Some(config),
            pty: None,
            tag: None,
        };

        // Call start and process the stream
        let mut stream = client.start(request).await
            .map_err(|e| Error::other(format!("gRPC start failed: {}", e)))?
            .into_inner();

        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut exit_code = 0;
        let mut error: Option<String> = None;

        while let Some(resp) = stream.message().await.map_err(|e| Error::other(format!("gRPC stream error: {}", e)))? {
            if let Some(event) = resp.event {
                match event.event {
                    Some(process_event::Event::Data(data_event)) => {
                        if let Some(process_event::data_event::Output::Stdout(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stdout.push_str(&s);
                            }
                        }
                        if let Some(process_event::data_event::Output::Stderr(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stderr.push_str(&s);
                            }
                        }
                    }
                    Some(process_event::Event::End(end_event)) => {
                        exit_code = end_event.exit_code;
                        if let Some(e) = end_event.error {
                            error = Some(e);
                        }
                        break;
                    }
                    _ => {}
                }
            }
        }

        Ok(CommandResult {
            stdout,
            stderr,
            exit_code,
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
        let mut client = client.lock().await;
        let config = ProcessConfig {
            cmd: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            envs: env.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
            cwd: None,
        };
        let request = StartRequest {
            process: Some(config),
            pty: None,
            tag: None,
        };
        let mut stream = client.start(request).await
            .map_err(|e| Error::other(format!("gRPC start failed: {}", e)))?
            .into_inner();
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut exit_code = 0;
        let mut error: Option<String> = None;
        while let Some(resp) = stream.message().await.map_err(|e| Error::other(format!("gRPC stream error: {}", e)))? {
            if let Some(event) = resp.event {
                match event.event {
                    Some(process_event::Event::Data(data_event)) => {
                        if let Some(process_event::data_event::Output::Stdout(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stdout.push_str(&s);
                            }
                        }
                        if let Some(process_event::data_event::Output::Stderr(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stderr.push_str(&s);
                            }
                        }
                    }
                    Some(process_event::Event::End(end_event)) => {
                        exit_code = end_event.exit_code;
                        if let Some(e) = end_event.error {
                            error = Some(e);
                        }
                        break;
                    }
                    _ => {}
                }
            }
        }
        Ok(CommandResult { stdout, stderr, exit_code, error })
    }

    async fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult> {
        let client = self.get_process_client()?;
        let mut client = client.lock().await;
        let config = ProcessConfig {
            cmd: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            envs: std::collections::HashMap::new(),
            cwd: Some(cwd.to_string()),
        };
        let request = StartRequest {
            process: Some(config),
            pty: None,
            tag: None,
        };
        let mut stream = client.start(request).await
            .map_err(|e| Error::other(format!("gRPC start failed: {}", e)))?
            .into_inner();
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut exit_code = 0;
        let mut error: Option<String> = None;
        while let Some(resp) = stream.message().await.map_err(|e| Error::other(format!("gRPC stream error: {}", e)))? {
            if let Some(event) = resp.event {
                match event.event {
                    Some(process_event::Event::Data(data_event)) => {
                        if let Some(process_event::data_event::Output::Stdout(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stdout.push_str(&s);
                            }
                        }
                        if let Some(process_event::data_event::Output::Stderr(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stderr.push_str(&s);
                            }
                        }
                    }
                    Some(process_event::Event::End(end_event)) => {
                        exit_code = end_event.exit_code;
                        if let Some(e) = end_event.error {
                            error = Some(e);
                        }
                        break;
                    }
                    _ => {}
                }
            }
        }
        Ok(CommandResult { stdout, stderr, exit_code, error })
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
        let mut client = client.lock().await;
        let config = ProcessConfig {
            cmd: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            envs: env.cloned().unwrap_or_default(),
            cwd: cwd.map(|s| s.to_string()),
        };
        let request = StartRequest {
            process: Some(config),
            pty: None,
            tag: None,
        };
        let mut stream = client.start(request).await
            .map_err(|e| Error::other(format!("gRPC start failed: {}", e)))?
            .into_inner();
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut exit_code = 0;
        let mut error: Option<String> = None;
        while let Some(resp) = stream.message().await.map_err(|e| Error::other(format!("gRPC stream error: {}", e)))? {
            if let Some(event) = resp.event {
                match event.event {
                    Some(process_event::Event::Data(data_event)) => {
                        if let Some(process_event::data_event::Output::Stdout(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stdout.push_str(&s);
                            }
                        }
                        if let Some(process_event::data_event::Output::Stderr(ref bytes)) = data_event.output {
                            if let Ok(s) = String::from_utf8(bytes.clone()) {
                                stderr.push_str(&s);
                            }
                        }
                    }
                    Some(process_event::Event::End(end_event)) => {
                        exit_code = end_event.exit_code;
                        if let Some(e) = end_event.error {
                            error = Some(e);
                        }
                        break;
                    }
                    _ => {}
                }
            }
        }
        Ok(CommandResult { stdout, stderr, exit_code, error })
    }

    async fn start(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle> {
        self.start_with_options(cmd, args, None, None).await
    }

    async fn start_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<AsyncCommandHandle> {
        self.start_with_options(cmd, args, Some(env), None).await
    }

    async fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<AsyncCommandHandle> {
        use tokio::sync::{mpsc, oneshot};
        let client = self.get_process_client()?;
        let mut client = client.lock().await;
        let config = ProcessConfig {
            cmd: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            envs: env.cloned().unwrap_or_default(),
            cwd: cwd.map(|s| s.to_string()),
        };
        let request = StartRequest {
            process: Some(config),
            pty: None,
            tag: None,
        };
        let mut stream = client.start(request).await
            .map_err(|e| Error::other(format!("gRPC start failed: {}", e)))?
            .into_inner();
        let (stdout_tx, stdout_rx) = mpsc::unbounded_channel();
        let (stderr_tx, stderr_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = oneshot::channel();
        tokio::spawn(async move {
            let mut stdout = String::new();
            let mut stderr = String::new();
            let mut exit_code = 0;
            let mut error: Option<String> = None;
            while let Some(resp) = stream.message().await.ok().flatten() {
                if let Some(event) = resp.event {
                    match event.event {
                        Some(process_event::Event::Data(data_event)) => {
                            if let Some(process_event::data_event::Output::Stdout(ref bytes)) = data_event.output {
                                if let Ok(s) = String::from_utf8(bytes.clone()) {
                                    let _ = stdout_tx.send(s.clone());
                                    stdout.push_str(&s);
                                }
                            }
                            if let Some(process_event::data_event::Output::Stderr(ref bytes)) = data_event.output {
                                if let Ok(s) = String::from_utf8(bytes.clone()) {
                                    let _ = stderr_tx.send(s.clone());
                                    stderr.push_str(&s);
                                }
                            }
                        }
                        Some(process_event::Event::End(end_event)) => {
                            exit_code = end_event.exit_code;
                            if let Some(e) = end_event.error {
                                error = Some(e);
                            }
                            break;
                        }
                        _ => {}
                    }
                }
            }
            let _ = exit_tx.send(CommandResult { stdout, stderr, exit_code, error });
        });
        Ok(AsyncCommandHandle::new(0, stdout_rx, stderr_rx, exit_rx))
    }

    async fn list(&self) -> Result<Vec<ProcessInfo>> {
        let client = self.get_process_client()?;
        let mut client = client.lock().await;
        let response = client.list(tonic::Request::new(e2b_connect::process::ListRequest {})).await
            .map_err(|e| Error::other(format!("gRPC list failed: {}", e)))?;
        let processes = response.into_inner().processes;
        Ok(processes.into_iter().map(|p| ProcessInfo {
            pid: p.pid as i32,
            tag: p.tag,
            cmd: p.config.as_ref().map(|c| c.cmd.clone()).unwrap_or_default(),
            args: p.config.as_ref().map(|c| c.args.clone()).unwrap_or_default(),
            envs: p.config.as_ref().map(|c| c.envs.clone()).unwrap_or_default(),
            cwd: p.config.as_ref().and_then(|c| c.cwd.clone()),
        }).collect())
    }

    async fn kill(&self, pid: i32) -> Result<()> {
        use e2b_connect::process::{SendSignalRequest, ProcessSelector, process_selector, Signal};
        let client = self.get_process_client()?;
        let mut client = client.lock().await;
        let selector = ProcessSelector {
            selector: Some(process_selector::Selector::Pid(pid as u32)),
        };
        let request = SendSignalRequest {
            process: Some(selector),
            signal: Signal::Sigkill as i32,
        };
        client.send_signal(request).await
            .map_err(|e| Error::other(format!("gRPC send_signal failed: {}", e)))?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl AsyncPty for RpcClient {
    async fn create(&self, cmd: &str, args: &[&str]) -> Result<AsyncPtyHandle> {
        self.create_with_options(cmd, args, None, None, None).await
    }

    async fn create_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<AsyncPtyHandle> {
        self.create_with_options(cmd, args, Some(env), None, None).await
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
        let mut client = client.lock().await;
        let config = ProcessConfig {
            cmd: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            envs: env.cloned().unwrap_or_default(),
            cwd: cwd.map(|s| s.to_string()),
        };
        let pty = size.map(|pty_size| Pty {
            size: Some(pty::Size {
                cols: pty_size.cols,
                rows: pty_size.rows,
            }),
        });
        let request = StartRequest {
            process: Some(config),
            pty,
            tag: None,
        };
        let mut stream = client.start(request).await
            .map_err(|e| Error::other(format!("gRPC start failed: {}", e)))?
            .into_inner();
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        // PTY id is not available in proto, so use a dummy value
        let pty_id = uuid::Uuid::new_v4().to_string();
        tokio::spawn(async move {
            while let Some(resp) = stream.message().await.ok().flatten() {
                if let Some(event) = resp.event {
                    match event.event {
                        Some(process_event::Event::Data(data_event)) => {
                            if let Some(process_event::data_event::Output::Pty(ref bytes)) = data_event.output {
                                let _ = output_tx.send(bytes.clone());
                            }
                        }
                        Some(process_event::Event::End(_end_event)) => {
                            break;
                        }
                        _ => {}
                    }
                }
            }
            let _ = exit_tx.send(0); // Send dummy exit code
        });
        Ok(AsyncPtyHandle::new(0, pty_id, output_rx, exit_rx))
    }

    async fn list(&self) -> Result<Vec<String>> {
        // Use pgrep -a to list all processes and filter for PTY sessions
        let result = self.run("pgrep", &["-a"]).await?;
        let mut pty_pids = Vec::new();
        for line in result.stdout.lines() {
            // Example line: "1234 /usr/bin/pty ..."
            let mut parts = line.split_whitespace();
            if let Some(pid) = parts.next() {
                let cmdline = parts.collect::<Vec<_>>().join(" ");
                // Heuristic: look for 'pty' in the command line
                if cmdline.contains("pty") {
                    pty_pids.push(pid.to_string());
                }
            }
        }
        Ok(pty_pids)
    }

    async fn kill(&self, pty_id: &str) -> Result<()> {
        // Assume pty_id is a PID and run 'kill <pty_id>'
        let result = self.run("kill", &[pty_id]).await?;
        if result.exit_code == 0 {
            Ok(())
        } else {
            Err(Error::other(format!("Failed to kill PTY process {}: {}", pty_id, result.stderr)))
        }
    }
}
