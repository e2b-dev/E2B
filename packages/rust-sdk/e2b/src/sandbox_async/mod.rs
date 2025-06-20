use crate::{
    client::{models, ApiClient},
    commands::{AsyncCommandHandle, AsyncCommands, CommandResult, ProcessInfo},
    config::Config,
    envd::{EnvdClient, ConnectRpcClient},
    error::{Error, Result},
    filesystem::{AsyncFilesystem, AsyncWatchHandle, EntryInfo, WriteEntry},
    pty::{AsyncPty, AsyncPtyHandle, PtySize},
};
use std::collections::HashMap;
use url::Url;

pub struct Sandbox {
    pub id: String,
    pub template_id: String,
    pub client_id: String,
    client: ApiClient,
    rpc_client: ConnectRpcClient,
    pub commands: SandboxCommands,
    pub filesystem: SandboxFilesystem,
}

/// Commands interface for the sandbox
pub struct SandboxCommands {
    rpc_client: ConnectRpcClient,
}

/// Filesystem interface for the sandbox  
pub struct SandboxFilesystem {
    rpc_client: ConnectRpcClient,
}

impl Sandbox {
    pub async fn create(template_id: &str) -> Result<Self> {
        let config = Config::new()?;
        Self::create_with_config(template_id, config).await
    }

    pub async fn create_with_config(template_id: &str, config: Config) -> Result<Self> {
        let client = ApiClient::new(config)?;

        let new_sandbox = models::NewSandbox {
            template_id: template_id.to_string(),
            alias: None,
            metadata: None,
            env_vars: None,
            timeout: Some(5 * 60),
            auto_pause: false,
            secure: false,
        };

        let request = client.post("/sandboxes").json(&new_sandbox);
        let sandbox: models::Sandbox = client.send_json(request).await?;

        let full_sandbox_id = format!("{}-{}", sandbox.sandbox_id, sandbox.client_id);
        let envd_url = Self::build_envd_url(&full_sandbox_id, &client.config.domain)?;
        tracing::info!("Built envd URL: {}", envd_url);
        
        // Use the same envd URL for Connect RPC
        tracing::info!("Using Connect endpoint: {}", envd_url);
        
        let envd_client = EnvdClient::new(client.client.clone(), envd_url.clone());
        let rpc_client = ConnectRpcClient::new(envd_client)
            .with_username("user".to_string())
            .with_connect_endpoint(&envd_url)?;

        Ok(Self {
            id: sandbox.sandbox_id.clone(),
            template_id: sandbox.template_id,
            client_id: sandbox.client_id,
            commands: SandboxCommands { rpc_client: rpc_client.clone() },
            filesystem: SandboxFilesystem { rpc_client: rpc_client.clone() },
            client,
            rpc_client,
        })
    }

    pub async fn connect(sandbox_id: &str) -> Result<Self> {
        let config = Config::new()?;
        Self::connect_with_config(sandbox_id, config).await
    }

    pub async fn connect_with_config(sandbox_id: &str, config: Config) -> Result<Self> {
        let client = ApiClient::new(config)?;

        let request = client.get(&format!("/sandboxes/{}", sandbox_id));
        let sandbox: models::SandboxDetail = client.send_json(request).await?;
        tracing::info!("Connected to sandbox. detail={:#?}", sandbox);

        let full_sandbox_id = format!("{}-{}", sandbox.sandbox_id, sandbox.client_id);
        let envd_url = Self::build_envd_url(&full_sandbox_id, &client.config.domain)?;
        let envd_client = EnvdClient::new(client.client.clone(), envd_url.clone());
        let rpc_client = ConnectRpcClient::new(envd_client)
            .with_username("user".to_string())
            .with_connect_endpoint(&envd_url)?;

        Ok(Self {
            id: sandbox.sandbox_id.clone(),
            template_id: sandbox.template_id,
            client_id: sandbox.client_id,
            commands: SandboxCommands { rpc_client: rpc_client.clone() },
            filesystem: SandboxFilesystem { rpc_client: rpc_client.clone() },
            client,
            rpc_client,
        })
    }

    pub async fn kill(&self) -> Result<()> {
        let request = self.client.delete(&format!("/sandboxes/{}", self.id));
        self.client.send_empty(request).await
    }

    pub async fn close(&self) -> Result<()> {
        self.kill().await
    }

    pub async fn info(&self) -> Result<models::SandboxDetail> {
        let request = self.client.get(&format!("/sandboxes/{}", self.id));
        self.client.send_json(request).await
    }

    pub async fn list() -> Result<Vec<models::ListedSandbox>> {
        let config = Config::new()?;
        Self::list_with_config(config).await
    }

    pub async fn list_with_config(config: Config) -> Result<Vec<models::ListedSandbox>> {
        let client = ApiClient::new(config)?;
        let request = client.get("/sandboxes");
        let response: Vec<models::ListedSandbox> = client.send_json(request).await?;
        Ok(response)
    }

    pub async fn logs(&self) -> Result<Vec<models::SandboxLog>> {
        let request = self.client.get(&format!("/sandboxes/{}/logs", self.id));
        let response: models::SandboxLogs = self.client.send_json(request).await?;
        Ok(response.logs)
    }

    pub async fn create_with_metadata(
        template_id: &str,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Result<Self> {
        let config = Config::new()?;
        Self::create_with_metadata_and_config(template_id, metadata, config).await
    }

    pub async fn create_with_metadata_and_config(
        template_id: &str,
        metadata: HashMap<String, serde_json::Value>,
        config: Config,
    ) -> Result<Self> {
        let client = ApiClient::new(config)?;

        let new_sandbox = models::NewSandbox {
            template_id: template_id.to_string(),
            alias: None,
            metadata: Some(serde_json::to_value(metadata)?),
            env_vars: None,
            timeout: None,
            auto_pause: false,
            secure: false,
        };

        let request = client.post("/sandboxes").json(&new_sandbox);
        let sandbox: models::Sandbox = client.send_json(request).await?;

        // Construct envd URL based on sandbox ID + client ID
        let full_sandbox_id = format!("{}-{}", sandbox.sandbox_id, sandbox.client_id);
        let envd_url = Self::build_envd_url(&full_sandbox_id, &client.config.domain)?;
        let envd_client = EnvdClient::new(client.client.clone(), envd_url.clone());
        let rpc_client = ConnectRpcClient::new(envd_client)
            .with_username("user".to_string())
            .with_connect_endpoint(&envd_url)?;

        Ok(Self {
            id: sandbox.sandbox_id.clone(),
            template_id: sandbox.template_id,
            client_id: sandbox.client_id,
            commands: SandboxCommands { rpc_client: rpc_client.clone() },
            filesystem: SandboxFilesystem { rpc_client: rpc_client.clone() },
            client,
            rpc_client,
        })
    }
}

// Implement filesystem operations for Sandbox
#[async_trait::async_trait]
impl AsyncFilesystem for Sandbox {
    async fn list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        AsyncFilesystem::list(&self.rpc_client, path).await
    }

    async fn read(&self, path: &str) -> Result<Vec<u8>> {
        self.rpc_client.read(path).await
    }

    async fn write(&self, path: &str, data: &[u8]) -> Result<()> {
        self.rpc_client.write(path, data).await
    }

    async fn write_multiple(&self, entries: &[WriteEntry]) -> Result<()> {
        self.rpc_client.write_multiple(entries).await
    }

    async fn remove(&self, path: &str) -> Result<()> {
        self.rpc_client.remove(path).await
    }

    async fn make_dir(&self, path: &str) -> Result<()> {
        self.rpc_client.make_dir(path).await
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        self.rpc_client.exists(path).await
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        self.rpc_client.rename(old_path, new_path).await
    }

    async fn watch(&self, path: &str) -> Result<AsyncWatchHandle> {
        self.rpc_client.watch(path).await
    }
}

// Implement command operations for Sandbox
#[async_trait::async_trait]
impl AsyncCommands for Sandbox {
    async fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
        self.rpc_client.run(cmd, args).await
    }

    async fn run_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<CommandResult> {
        self.rpc_client.run_with_env(cmd, args, env).await
    }

    async fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult> {
        self.rpc_client.run_with_cwd(cmd, args, cwd).await
    }

    async fn run_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        timeout: Option<std::time::Duration>,
    ) -> Result<CommandResult> {
        self.rpc_client
            .run_with_options(cmd, args, env, cwd, timeout)
            .await
    }

    async fn start(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle> {
        self.rpc_client.start(cmd, args).await
    }

    async fn start_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<AsyncCommandHandle> {
        self.rpc_client.start_with_env(cmd, args, env).await
    }

    async fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<AsyncCommandHandle> {
        self.rpc_client
            .start_with_options(cmd, args, env, cwd)
            .await
    }

    async fn list(&self) -> Result<Vec<ProcessInfo>> {
        AsyncCommands::list(&self.rpc_client).await
    }

    async fn kill(&self, pid: i32) -> Result<()> {
        AsyncCommands::kill(&self.rpc_client, pid).await
    }
}

// Implement PTY operations for Sandbox
#[async_trait::async_trait]
impl AsyncPty for Sandbox {
    async fn create(&self, cmd: &str, args: &[&str]) -> Result<AsyncPtyHandle> {
        self.rpc_client.create(cmd, args).await
    }

    async fn create_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<AsyncPtyHandle> {
        self.rpc_client.create_with_env(cmd, args, env).await
    }

    async fn create_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        size: Option<PtySize>,
    ) -> Result<AsyncPtyHandle> {
        self.rpc_client
            .create_with_options(cmd, args, env, cwd, size)
            .await
    }

    async fn list(&self) -> Result<Vec<String>> {
        AsyncPty::list(&self.rpc_client).await
    }

    async fn kill(&self, pty_id: &str) -> Result<()> {
        AsyncPty::kill(&self.rpc_client, pty_id).await
    }
}

pub trait HasUrl {
    fn get_url(&self) -> Result<Url>;
}
impl HasUrl for Sandbox {
    fn get_url(&self) -> Result<Url> {
        Url::parse(&format!("https://{}-{}.e2b.app/", self.id, self.client_id))
            .map_err(|e| Error::invalid_argument(format!("Failed to parse URL: {}", e)))
    }
}

impl Sandbox {
    // Convenience methods that match Python SDK API

    /// Read a file as text
    pub async fn read_text(&self, path: &str) -> Result<String> {
        AsyncFilesystem::read_text(self, path).await
    }

    /// Write text to a file
    pub async fn write_text(&self, path: &str, content: &str) -> Result<()> {
        AsyncFilesystem::write_text(self, path, content).await
    }

    /// List files in a directory
    pub async fn files_list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        AsyncFilesystem::list(self, path).await
    }

    /// Check if a file exists
    pub async fn files_exists(&self, path: &str) -> Result<bool> {
        AsyncFilesystem::exists(self, path).await
    }

    /// Remove a file or directory
    pub async fn files_remove(&self, path: &str) -> Result<()> {
        AsyncFilesystem::remove(self, path).await
    }

    /// Create a directory
    pub async fn files_make_dir(&self, path: &str) -> Result<()> {
        AsyncFilesystem::make_dir(self, path).await
    }

    /// Rename/move a file or directory
    pub async fn files_rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        AsyncFilesystem::rename(self, old_path, new_path).await
    }

    /// Watch a directory for changes
    pub async fn files_watch(&self, path: &str) -> Result<AsyncWatchHandle> {
        AsyncFilesystem::watch(self, path).await
    }

    /// Run a command and wait for completion
    pub async fn run_command(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
        AsyncCommands::run(self, cmd, args).await
    }

    /// Start a command and get a handle for streaming
    pub async fn start_command(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle> {
        AsyncCommands::start(self, cmd, args).await
    }

    /// List running processes
    pub async fn processes_list(&self) -> Result<Vec<ProcessInfo>> {
        AsyncCommands::list(self).await
    }

    /// Kill a process by PID
    pub async fn processes_kill(&self, pid: i32) -> Result<()> {
        AsyncCommands::kill(self, pid).await
    }

    /// Create a PTY session
    pub async fn pty_create(&self, cmd: &str, args: &[&str]) -> Result<AsyncPtyHandle> {
        AsyncPty::create(self, cmd, args).await
    }

    /// List active PTY sessions
    pub async fn pty_list(&self) -> Result<Vec<String>> {
        AsyncPty::list(self).await
    }

    /// Kill a PTY session
    pub async fn pty_kill(&self, pty_id: &str) -> Result<()> {
        AsyncPty::kill(self, pty_id).await
    }

    /// Build envd URL for sandbox
    fn build_envd_url(sandbox_id: &str, base_domain: &url::Url) -> Result<String> {
        // Convert base domain to envd domain
        // e.g. https://api.e2b.dev -> https://{sandbox_id}.e2b.dev
        let host = base_domain.host_str().unwrap_or("api.e2b.app");
        let envd_host = if host.starts_with("api.") {
            format!("49983-{}.{}", sandbox_id, &host[4..])
        } else {
            format!("49983-{}.{}", sandbox_id, host)
        };

        let mut envd_url = base_domain.clone();
        envd_url
            .set_host(Some(&envd_host))
            .map_err(|e| Error::invalid_argument(format!("Invalid envd host: {}", e)))?;
        Ok(envd_url.to_string())
    }
}

// Implement AsyncCommands for SandboxCommands
#[async_trait::async_trait]
impl AsyncCommands for SandboxCommands {
    async fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
        self.rpc_client.run(cmd, args).await
    }

    async fn run_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<CommandResult> {
        self.rpc_client.run_with_env(cmd, args, env).await
    }

    async fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult> {
        self.rpc_client.run_with_cwd(cmd, args, cwd).await
    }

    async fn run_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        timeout: Option<std::time::Duration>,
    ) -> Result<CommandResult> {
        self.rpc_client
            .run_with_options(cmd, args, env, cwd, timeout)
            .await
    }

    async fn start(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle> {
        self.rpc_client.start(cmd, args).await
    }

    async fn start_with_env(
        &self,
        cmd: &str,
        args: &[&str],
        env: &HashMap<String, String>,
    ) -> Result<AsyncCommandHandle> {
        self.rpc_client.start_with_env(cmd, args, env).await
    }

    async fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<AsyncCommandHandle> {
        self.rpc_client
            .start_with_options(cmd, args, env, cwd)
            .await
    }

    async fn list(&self) -> Result<Vec<ProcessInfo>> {
        AsyncCommands::list(&self.rpc_client).await
    }

    async fn kill(&self, pid: i32) -> Result<()> {
        AsyncCommands::kill(&self.rpc_client, pid).await
    }
}

// Implement AsyncFilesystem for SandboxFilesystem
#[async_trait::async_trait]
impl AsyncFilesystem for SandboxFilesystem {
    async fn list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        AsyncFilesystem::list(&self.rpc_client, path).await
    }

    async fn read(&self, path: &str) -> Result<Vec<u8>> {
        self.rpc_client.read(path).await
    }

    async fn write(&self, path: &str, data: &[u8]) -> Result<()> {
        self.rpc_client.write(path, data).await
    }

    async fn write_multiple(&self, entries: &[WriteEntry]) -> Result<()> {
        self.rpc_client.write_multiple(entries).await
    }

    async fn remove(&self, path: &str) -> Result<()> {
        self.rpc_client.remove(path).await
    }

    async fn make_dir(&self, path: &str) -> Result<()> {
        self.rpc_client.make_dir(path).await
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        self.rpc_client.exists(path).await
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        self.rpc_client.rename(old_path, new_path).await
    }

    async fn watch(&self, path: &str) -> Result<AsyncWatchHandle> {
        self.rpc_client.watch(path).await
    }
}
