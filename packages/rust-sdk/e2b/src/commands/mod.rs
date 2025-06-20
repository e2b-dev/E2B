use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::mpsc;
use crate::error::{Error, Result};

/// Command stdout output type
pub type Stdout = String;

/// Command stderr output type  
pub type Stderr = String;

/// PTY output type
pub type PtyOutput = Vec<u8>;

/// Pseudo-terminal size configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySize {
    pub rows: u32,
    pub cols: u32,
}

impl Default for PtySize {
    fn default() -> Self {
        Self { rows: 24, cols: 80 }
    }
}

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub stderr: String,
    pub stdout: String,
    pub exit_code: i32,
    pub error: Option<String>,
}

/// Exception for command exit with non-zero code
#[derive(Debug, Clone)]
pub struct CommandExitException {
    pub stderr: String,
    pub stdout: String,
    pub exit_code: i32,
    pub error: Option<String>,
}

impl std::fmt::Display for CommandExitException {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Command exited with code {} and error:\n{}", self.exit_code, self.stderr)
    }
}

impl std::error::Error for CommandExitException {}

impl From<CommandResult> for CommandExitException {
    fn from(result: CommandResult) -> Self {
        Self {
            stderr: result.stderr,
            stdout: result.stdout,
            exit_code: result.exit_code,
            error: result.error,
        }
    }
}

/// Process information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: i32,
    pub tag: Option<String>,
    pub cmd: String,
    pub args: Vec<String>,
    pub envs: HashMap<String, String>,
    pub cwd: Option<String>,
}

/// Handle for managing running commands
pub struct CommandHandle {
    pub pid: i32,
    stdout_rx: Option<mpsc::UnboundedReceiver<String>>,
    stderr_rx: Option<mpsc::UnboundedReceiver<String>>,
    exit_rx: Option<tokio::sync::oneshot::Receiver<CommandResult>>,
}

impl CommandHandle {
    pub fn new(
        pid: i32,
        stdout_rx: mpsc::UnboundedReceiver<String>,
        stderr_rx: mpsc::UnboundedReceiver<String>,
        exit_rx: tokio::sync::oneshot::Receiver<CommandResult>,
    ) -> Self {
        Self {
            pid,
            stdout_rx: Some(stdout_rx),
            stderr_rx: Some(stderr_rx),
            exit_rx: Some(exit_rx),
        }
    }

    /// Wait for command to complete and return result
    pub async fn wait(&mut self) -> Result<CommandResult> {
        if let Some(exit_rx) = self.exit_rx.take() {
            exit_rx.await.map_err(|_| Error::other("Command wait failed"))
        } else {
            Err(Error::other("Command already waited"))
        }
    }

    /// Kill the running command
    pub async fn kill(&self) -> Result<()> {
        // Implementation would send kill signal via RPC
        Ok(())
    }

    /// Send input to command stdin
    pub async fn send_stdin(&self, _input: &str) -> Result<()> {
        // Implementation would send stdin via RPC
        Ok(())
    }

    /// Get stdout stream
    pub fn stdout_stream(&mut self) -> Option<mpsc::UnboundedReceiver<String>> {
        self.stdout_rx.take()
    }

    /// Get stderr stream
    pub fn stderr_stream(&mut self) -> Option<mpsc::UnboundedReceiver<String>> {
        self.stderr_rx.take()
    }
}

/// Async handle for managing running commands
pub struct AsyncCommandHandle {
    pub pid: i32,
    stdout_rx: Option<mpsc::UnboundedReceiver<String>>,
    stderr_rx: Option<mpsc::UnboundedReceiver<String>>,
    exit_rx: Option<tokio::sync::oneshot::Receiver<CommandResult>>,
}

impl AsyncCommandHandle {
    pub fn new(
        pid: i32,
        stdout_rx: mpsc::UnboundedReceiver<String>,
        stderr_rx: mpsc::UnboundedReceiver<String>,
        exit_rx: tokio::sync::oneshot::Receiver<CommandResult>,
    ) -> Self {
        Self {
            pid,
            stdout_rx: Some(stdout_rx),
            stderr_rx: Some(stderr_rx),
            exit_rx: Some(exit_rx),
        }
    }

    /// Create a mock handle for testing
    #[cfg(test)]
    pub fn new_mock() -> Self {
        let (_stdout_tx, stdout_rx) = mpsc::unbounded_channel();
        let (_stderr_tx, stderr_rx) = mpsc::unbounded_channel();
        let (_exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Self {
            pid: 12345,
            stdout_rx: Some(stdout_rx),
            stderr_rx: Some(stderr_rx),
            exit_rx: Some(exit_rx),
        }
    }

    /// Wait for command to complete and return result
    pub async fn wait(&mut self) -> Result<CommandResult> {
        if let Some(exit_rx) = self.exit_rx.take() {
            exit_rx.await.map_err(|_| Error::other("Command wait failed"))
        } else {
            Err(Error::other("Command already waited"))
        }
    }

    /// Kill the running command
    pub async fn kill(&self) -> Result<()> {
        // Implementation would send kill signal via RPC
        Ok(())
    }

    /// Send input to command stdin
    pub async fn send_stdin(&self, _input: &str) -> Result<()> {
        // Implementation would send stdin via RPC
        Ok(())
    }

    /// Get stdout stream
    pub fn stdout_stream(&mut self) -> Option<mpsc::UnboundedReceiver<String>> {
        self.stdout_rx.take()
    }

    /// Get stderr stream
    pub fn stderr_stream(&mut self) -> Option<mpsc::UnboundedReceiver<String>> {
        self.stderr_rx.take()
    }
}

/// Command execution trait for async implementation
#[async_trait::async_trait]
pub trait AsyncCommands {
    /// Execute a command and return the result
    async fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult>;

    /// Execute a command with environment variables
    async fn run_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<CommandResult>;

    /// Execute a command in a specific working directory
    async fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult>;

    /// Execute a command with full options
    async fn run_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        timeout: Option<std::time::Duration>,
    ) -> Result<CommandResult>;

    /// Start a command and return a handle for streaming
    async fn start(&self, cmd: &str, args: &[&str]) -> Result<AsyncCommandHandle>;

    /// Start a command with environment variables
    async fn start_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<AsyncCommandHandle>;

    /// Start a command with full options
    async fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<AsyncCommandHandle>;

    /// List running processes
    async fn list(&self) -> Result<Vec<ProcessInfo>>;

    /// Kill a process by PID
    async fn kill(&self, pid: i32) -> Result<()>;
}

/// Command execution trait for sync implementation
pub trait Commands {
    /// Execute a command and return the result
    fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult>;

    /// Execute a command with environment variables
    fn run_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<CommandResult>;

    /// Execute a command in a specific working directory
    fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult>;

    /// Execute a command with full options
    fn run_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        timeout: Option<std::time::Duration>,
    ) -> Result<CommandResult>;

    /// Start a command and return a handle for streaming
    fn start(&self, cmd: &str, args: &[&str]) -> Result<CommandHandle>;

    /// Start a command with environment variables
    fn start_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<CommandHandle>;

    /// Start a command with full options
    fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<CommandHandle>;

    /// List running processes
    fn list(&self) -> Result<Vec<ProcessInfo>>;

    /// Kill a process by PID
    fn kill(&self, pid: i32) -> Result<()>;
}