use std::collections::HashMap;
use tokio::sync::mpsc;
use crate::error::{Error, Result};
pub use crate::commands::{PtySize, PtyOutput};

/// PTY (Pseudo-Terminal) handle for interactive sessions
pub struct PtyHandle {
    pub pid: i32,
    pub pty_id: String,
    output_rx: Option<mpsc::UnboundedReceiver<PtyOutput>>,
    exit_rx: Option<tokio::sync::oneshot::Receiver<i32>>,
}

impl PtyHandle {
    pub fn new(
        pid: i32,
        pty_id: String,
        output_rx: mpsc::UnboundedReceiver<PtyOutput>,
        exit_rx: tokio::sync::oneshot::Receiver<i32>,
    ) -> Self {
        Self {
            pid,
            pty_id,
            output_rx: Some(output_rx),
            exit_rx: Some(exit_rx),
        }
    }

    /// Send input to the PTY
    pub async fn send_input(&self, _input: &[u8]) -> Result<()> {
        // Implementation would send input via RPC
        Ok(())
    }

    /// Resize the PTY
    pub async fn resize(&self, _size: PtySize) -> Result<()> {
        // Implementation would resize PTY via RPC
        Ok(())
    }

    /// Kill the PTY session
    pub async fn kill(&self) -> Result<()> {
        // Implementation would kill PTY via RPC
        Ok(())
    }

    /// Wait for PTY to exit and return exit code
    pub async fn wait(&mut self) -> Result<i32> {
        if let Some(exit_rx) = self.exit_rx.take() {
            exit_rx.await.map_err(|_| Error::other("PTY wait failed"))
        } else {
            Err(Error::other("PTY already waited"))
        }
    }

    /// Get output stream
    pub fn output_stream(&mut self) -> Option<mpsc::UnboundedReceiver<PtyOutput>> {
        self.output_rx.take()
    }
}

/// Async PTY handle for interactive sessions
pub struct AsyncPtyHandle {
    pub pid: i32,
    pub pty_id: String,
    output_rx: Option<mpsc::UnboundedReceiver<PtyOutput>>,
    exit_rx: Option<tokio::sync::oneshot::Receiver<i32>>,
}

impl AsyncPtyHandle {
    pub fn new(
        pid: i32,
        pty_id: String,
        output_rx: mpsc::UnboundedReceiver<PtyOutput>,
        exit_rx: tokio::sync::oneshot::Receiver<i32>,
    ) -> Self {
        Self {
            pid,
            pty_id,
            output_rx: Some(output_rx),
            exit_rx: Some(exit_rx),
        }
    }

    /// Send input to the PTY
    pub async fn send_input(&self, _input: &[u8]) -> Result<()> {
        // Implementation would send input via RPC
        Ok(())
    }

    /// Resize the PTY
    pub async fn resize(&self, _size: PtySize) -> Result<()> {
        // Implementation would resize PTY via RPC
        Ok(())
    }

    /// Kill the PTY session
    pub async fn kill(&self) -> Result<()> {
        // Implementation would kill PTY via RPC
        Ok(())
    }

    /// Wait for PTY to exit and return exit code
    pub async fn wait(&mut self) -> Result<i32> {
        if let Some(exit_rx) = self.exit_rx.take() {
            exit_rx.await.map_err(|_| Error::other("PTY wait failed"))
        } else {
            Err(Error::other("PTY already waited"))
        }
    }

    /// Get output stream
    pub fn output_stream(&mut self) -> Option<mpsc::UnboundedReceiver<PtyOutput>> {
        self.output_rx.take()
    }
}

/// PTY operations trait for async implementation
#[async_trait::async_trait]
pub trait AsyncPty {
    /// Create a new PTY session
    async fn create(&self, cmd: &str, args: &[&str]) -> Result<AsyncPtyHandle>;

    /// Create a PTY with environment variables
    async fn create_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<AsyncPtyHandle>;

    /// Create a PTY with full options
    async fn create_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        size: Option<PtySize>,
    ) -> Result<AsyncPtyHandle>;

    /// List active PTY sessions
    async fn list(&self) -> Result<Vec<String>>;

    /// Kill a PTY session by ID
    async fn kill(&self, pty_id: &str) -> Result<()>;
}

/// PTY operations trait for sync implementation
pub trait Pty {
    /// Create a new PTY session
    fn create(&self, cmd: &str, args: &[&str]) -> Result<PtyHandle>;

    /// Create a PTY with environment variables
    fn create_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<PtyHandle>;

    /// Create a PTY with full options
    fn create_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        size: Option<PtySize>,
    ) -> Result<PtyHandle>;

    /// List active PTY sessions
    fn list(&self) -> Result<Vec<String>>;

    /// Kill a PTY session by ID
    fn kill(&self, pty_id: &str) -> Result<()>;
}