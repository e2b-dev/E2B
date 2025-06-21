use crate::{
    commands::{AsyncCommandHandle, AsyncCommands},
    error::{Error, Result},
    sandbox_async::HasUrl,
};
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use std::sync::Arc;
use tokio::{
    time::{sleep, Duration, Instant},
    sync::Mutex
};
use url::Url;

/// Configuration options for VNC server
#[derive(Debug, Clone)]
pub struct VncConfig {
    /// VNC server port (default: 5900)
    pub vnc_port: u16,
    /// noVNC web client port (default: 6080)
    pub novnc_port: u16,
    /// Enable authentication (default: true)
    pub enable_auth: bool,
    /// Custom password (if None, random password will be generated)
    pub password: Option<String>,
    /// Specific window ID to share (optional)
    pub window_id: Option<String>,
}

impl Default for VncConfig {
    fn default() -> Self {
        Self {
            vnc_port: 5900,
            novnc_port: 6080,
            enable_auth: true,
            password: None,
            window_id: None,
        }
    }
}

/// VNC server instance for remote desktop access
pub struct VncServer<T> {
    sandbox: T,
    config: VncConfig,
    vnc_process: Arc<Mutex<Option<AsyncCommandHandle>>>,
    xvfb_process: Arc<Mutex<Option<AsyncCommandHandle>>>,
    novnc_process: Arc<Mutex<Option<AsyncCommandHandle>>>,
    auth_password: Option<String>,
    last_xfce4_pid: Option<i32>,
    is_running: Arc<Mutex<bool>>,
}

impl<T> VncServer<T>
where
    T: AsyncCommands + HasUrl + Send + Sync,
{
    /// Create a new VNC server instance
    pub fn new(sandbox: T) -> Self {
        Self {
            sandbox,
            config: VncConfig::default(),
            vnc_process: Arc::new(Mutex::new(None)),
            xvfb_process: Arc::new(Mutex::new(None)),
            novnc_process: Arc::new(Mutex::new(None)),
            auth_password: None,
            last_xfce4_pid: None,
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Create a new VNC server instance with custom configuration
    pub fn new_with_config(sandbox: T, config: VncConfig) -> Self {
        Self {
            sandbox,
            config,
            vnc_process: Arc::new(Mutex::new(None)),
            xvfb_process: Arc::new(Mutex::new(None)),
            novnc_process: Arc::new(Mutex::new(None)),
            auth_password: None,
            last_xfce4_pid: None,
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&mut self) -> Result<()> {
        {
            let is_running = self.is_running.lock().await;
            if *is_running {
                return Ok(());
            }
        }

        if self.config.enable_auth && self.config.password.is_none() && self.auth_password.is_none() {
            self.auth_password = Some(self.generate_password());
        } else if self.config.enable_auth {
            self.auth_password = self.config.password.clone();
        }

        self.start_xvfb().await?;
        self.start_xfce4().await?;
        self.start_vnc_server().await?;
        self.start_novnc_proxy().await?;

        {
            let mut is_running = self.is_running.lock().await;
            *is_running = true;
        }
        Ok(())
    }

    /// Get the VNC connection URL
    pub async fn get_url(&self, options: Option<VncUrlOptions>) -> Result<String> {
        let is_running = self.is_running.lock().await;
        if !*is_running {
            return Err(Error::invalid_argument(
                "VNC server is not running".to_string(),
            ));
        }

        let opts = options.unwrap_or_default();
        let base_url = self.sandbox.get_url()?;
        let mut url = Url::parse(&format!(
            "https://{}-{}/vnc.html",
            self.config.novnc_port,
            base_url.host_str().unwrap_or_default(),
        ))
        .map_err(|e| Error::invalid_argument(format!("Failed to parse VNC URL: {}", e)))?;

        // Add query parameters
        let mut query_pairs = url.query_pairs_mut();

        if opts.autoconnect {
            query_pairs.append_pair("autoconnect", "true");
        }

        if opts.view_only {
            query_pairs.append_pair("view_only", "true");
        }

        if let Some(resize) = &opts.resize {
            query_pairs.append_pair("resize", resize);
        }

        if self.config.enable_auth {
            if let Some(password) = &self.auth_password {
                query_pairs.append_pair("password", password);
            }
        }

        drop(query_pairs);
        Ok(url.to_string())
    }

    /// Stop the VNC server
    pub async fn stop(&mut self) -> Result<()> {
        {
            let is_running = self.is_running.lock().await;
            if !*is_running {
                return Ok(());
            }
        }

        // Stop noVNC proxy
        if let Some(handle) = self.novnc_process.lock().await.take() {
            let _ = handle.kill().await;
        }

        // Stop VNC server
        if let Some(handle) = self.vnc_process.lock().await.take() {
            let _ = handle.kill().await;
        }

        // Kill any remaining VNC processes
        let _ = self.sandbox.run("pkill", &["-f", "x11vnc"]).await;
        let _ = self.sandbox.run("pkill", &["-f", "novnc"]).await;

        {
            let mut is_running = self.is_running.lock().await;
            *is_running = false;
        }
        Ok(())
    }

    /// Check if the VNC server is running
    pub async fn is_running(&self) -> bool {
        *self.is_running.lock().await
    }

    /// Get the authentication password (if authentication is enabled)
    pub fn get_password(&self) -> Option<&str> {
        self.auth_password.as_deref()
    }

    async fn start_xvfb(&mut self) -> Result<()> {
        let resolution = &format!("{}x{}x24", 1024, 768);
        let dpi = 96.to_string();
        let display = ":1";

        let xvfb_args = vec![
            display,
            "-ac",
            "-screen", "0",
            resolution,
            "-retro",
            "-dpi", &dpi,
            "-nolisten", "tcp",
            "&",
        ];

        let xvfb_handle = self.sandbox.start("Xvfb", &xvfb_args).await?;
        *self.xvfb_process.lock().await = Some(xvfb_handle);

        // 2) Wait for Xvfb to be ready (timeout after ~5 s)
        let start = Instant::now();
        let mut ready = false;
        while start.elapsed() < Duration::from_secs(5) {
            let status = self.sandbox.run("xdpyinfo", &["-display", display]).await?.exit_code;
            if status == 0 {
                ready = true;
                break;
            }
            sleep(Duration::from_millis(1000)).await;
        }
        if !ready {
            return Err(Error::other("Could not start Xvfb."));
        }
        Ok(())
    }

    async fn start_vnc_server(&mut self) -> Result<()> {
        let vnc_port_str = self.config.vnc_port.to_string();
        let mut vnc_args = vec![
            "-display",
            ":1",
            "-rfbport",
            &vnc_port_str,
            "-shared",
            "-forever",
            "-noxdamage",
            "-noxfixes",
            "-noxrandr",
            "&",
        ];

        if self.config.enable_auth {
            if let Some(password) = &self.auth_password {
                vnc_args.extend_from_slice(&["-passwd", password]);
            }
        } else {
            vnc_args.push("-nopw");
        }

        if let Some(window_id) = &self.config.window_id {
            vnc_args.extend_from_slice(&["-id", window_id]);
        }

        let handle = self.sandbox.start("x11vnc", &vnc_args).await?;
        tracing::info!("Started VNC. pid={}", handle.pid.clone().to_string());
        *self.vnc_process.lock().await = Some(handle);

        sleep(Duration::from_millis(1000)).await;

        Ok(())
    }

    async fn start_novnc_proxy(&mut self) -> Result<()> {
        let novnc_port_str = self.config.novnc_port.to_string();
        let vnc_target = format!("localhost:{}", self.config.vnc_port);

        let novnc_args = vec![
            "/opt/noVNC/utils",
            "&&",
            "./novnc_proxy",
            "--vnc",
            &vnc_target,
            "--listen",
            &novnc_port_str,
            "--web",
            "/opt/noVNC",
            ">",
            "/tmp/novnc.log",
            "2>&1",
            "&"
        ];

        let handle = self.sandbox.start("cd", &novnc_args).await?;
        tracing::info!("Started noVNC. pid={}", handle.pid.clone().to_string());
        *self.novnc_process.lock().await = Some(handle);

        sleep(Duration::from_millis(1000)).await;

        Ok(())
    }
    
    async fn start_xfce4(&mut self) -> Result<()> {
        match self.last_xfce4_pid {
            Some(pid) => {
                let pid_param = pid.to_string();
                let ps_args = vec![
                    "aux",
                    "|",
                    "grep",
                    &pid_param,
                    "grep",
                    "-v",
                    "grep",
                    "|",
                    "head",
                    "-n",
                    "1"];
                let result =self.sandbox.run("ps", &ps_args).await?;
                let stdout = result.stdout.trim();
                if stdout == "[xfce4-session] <defunct>" {
                    self.last_xfce4_pid = Some(self.sandbox.start("DISPLAY=:1 startxfce4 &", &[]).await?.pid);
                }
            }
            None => {
                self.last_xfce4_pid = Some(self.sandbox.start("DISPLAY=:1 startxfce4 &", &[]).await?.pid);
            }
        }

        match self.last_xfce4_pid {
            Some(pid) => tracing::info!("Started xfce4. pid={}", &pid.to_string()),
            None => tracing::info!("Failed to start xfce4.")
        }
        
        sleep(Duration::from_millis(1000)).await;
        Ok(())
    }

    fn generate_password(&self) -> String {
        thread_rng()
            .sample_iter(&Alphanumeric)
            .take(12)
            .map(char::from)
            .collect()
    }
}

/// Options for VNC URL generation
#[derive(Debug, Clone, Default)]
pub struct VncUrlOptions {
    /// Automatically connect when the page loads
    pub autoconnect: bool,
    /// Enable view-only mode (no input)
    pub view_only: bool,
    /// Resize behavior ("off", "scale", "remote")
    pub resize: Option<String>,
}

impl VncUrlOptions {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn with_autoconnect(mut self, autoconnect: bool) -> Self {
        self.autoconnect = autoconnect;
        self
    }

    pub fn with_view_only(mut self, view_only: bool) -> Self {
        self.view_only = view_only;
        self
    }

    pub fn with_resize(mut self, resize: String) -> Self {
        self.resize = Some(resize);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{commands::CommandResult, error::Result};
    use async_trait::async_trait;
    use std::collections::HashMap;

    // Mock sandbox for testing
    struct MockSandbox {
        commands: Arc<Mutex<Vec<String>>>,
    }

    impl MockSandbox {
        fn new() -> Self {
            Self {
                commands: Arc::new(Mutex::new(Vec::new())),
            }
        }

        async fn get_commands(&self) -> Vec<String> {
            self.commands.lock().await.clone()
        }
    }

    impl HasUrl for MockSandbox {
        fn get_url(&self) -> Result<Url> {
            Url::parse("http://localhost/")
            .map_err(|e| Error::invalid_argument(format!("Failed to parse URL: {}", e)))
        }
    }

    #[async_trait]
    impl AsyncCommands for MockSandbox {
        async fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
            let mut commands = self.commands.lock().await;
            commands.push(format!("{} {}", cmd, args.join(" ")));

            Ok(CommandResult {
                exit_code: 0,
                stdout: String::new(),
                stderr: String::new(),
                error: None,
            })
        }

        async fn run_with_env(
            &self,
            cmd: &str,
            args: &[&str],
            _env: &HashMap<String, String>,
        ) -> Result<CommandResult> {
            self.run(cmd, args).await
        }

        async fn run_with_cwd(
            &self,
            cmd: &str,
            args: &[&str],
            _cwd: &str,
        ) -> Result<CommandResult> {
            self.run(cmd, args).await
        }

        async fn run_with_options(
            &self,
            cmd: &str,
            args: &[&str],
            _env: Option<&HashMap<String, String>>,
            _cwd: Option<&str>,
            _timeout: Option<std::time::Duration>,
        ) -> Result<CommandResult> {
            self.run(cmd, args).await
        }

        async fn start(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle> {
            let mut commands = self.commands.lock().await;
            commands.push(format!("start: {} {}", cmd, args.join(" ")));

            // Return a mock handle
            Ok(AsyncCommandHandle::new_mock())
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
            _env: Option<&HashMap<String, String>>,
            _cwd: Option<&str>,
        ) -> Result<AsyncCommandHandle> {
            self.start(cmd, args).await
        }

        async fn list(&self) -> Result<Vec<crate::commands::ProcessInfo>> {
            Ok(vec![])
        }

        async fn kill(&self, _pid: i32) -> Result<()> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_vnc_server_creation() {
        let sandbox = MockSandbox::new();
        let vnc_server = VncServer::new(sandbox);

        assert!(!vnc_server.is_running().await);
    }

    #[tokio::test]
    async fn test_vnc_server_with_config() {
        let sandbox = MockSandbox::new();
        let config = VncConfig {
            vnc_port: 5901,
            novnc_port: 6081,
            enable_auth: false,
            password: None,
            window_id: Some("0x1234567".to_string()),
        };

        let vnc_server = VncServer::new_with_config(sandbox, config);
        assert_eq!(vnc_server.config.vnc_port, 5901);
        assert_eq!(vnc_server.config.novnc_port, 6081);
        assert!(!vnc_server.config.enable_auth);
    }

    #[tokio::test]
    async fn test_password_generation() {
        let sandbox = MockSandbox::new();
        let vnc_server = VncServer::new(sandbox);

        let password = vnc_server.generate_password();
        assert_eq!(password.len(), 12);
        assert!(password.chars().all(|c| c.is_alphanumeric()));
    }

    #[tokio::test]
    async fn test_url_options() {
        let options = VncUrlOptions::new()
            .with_autoconnect(true)
            .with_view_only(false)
            .with_resize("scale".to_string());

        assert!(options.autoconnect);
        assert!(!options.view_only);
        assert_eq!(options.resize, Some("scale".to_string()));
    }
}
