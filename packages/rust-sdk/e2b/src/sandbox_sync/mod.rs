use crate::{
    config::Config,
    error::Result,
    sandbox_async,
    filesystem::{Filesystem, EntryInfo, WriteEntry, WatchHandle},
    commands::{Commands, CommandResult, CommandHandle, ProcessInfo},
    pty::{Pty, PtyHandle, PtySize},
    client::models,
};
use std::collections::HashMap;
use tokio::runtime::Handle;

/// Synchronous sandbox wrapper around async implementation
pub struct Sandbox {
    inner: sandbox_async::Sandbox,
    rt: Handle,
}

impl Sandbox {
    /// Create a new sandbox
    pub fn create(template_id: &str) -> Result<Self> {
        let rt = Handle::current();
        let inner = rt.block_on(sandbox_async::Sandbox::create(template_id))?;
        Ok(Self { inner, rt })
    }

    /// Create a sandbox with custom configuration
    pub fn create_with_config(template_id: &str, config: Config) -> Result<Self> {
        let rt = Handle::current();
        let inner = rt.block_on(sandbox_async::Sandbox::create_with_config(template_id, config))?;
        Ok(Self { inner, rt })
    }

    /// Connect to an existing sandbox
    pub fn connect(sandbox_id: &str) -> Result<Self> {
        let rt = Handle::current();
        let inner = rt.block_on(sandbox_async::Sandbox::connect(sandbox_id))?;
        Ok(Self { inner, rt })
    }

    /// Connect to an existing sandbox with custom configuration
    pub fn connect_with_config(sandbox_id: &str, config: Config) -> Result<Self> {
        let rt = Handle::current();
        let inner = rt.block_on(sandbox_async::Sandbox::connect_with_config(sandbox_id, config))?;
        Ok(Self { inner, rt })
    }

    /// Kill the sandbox
    pub fn kill(&self) -> Result<()> {
        self.rt.block_on(self.inner.kill())
    }

    /// Get sandbox information
    pub fn info(&self) -> Result<models::SandboxDetail> {
        self.rt.block_on(self.inner.info())
    }

    /// List all sandboxes
    pub fn list() -> Result<Vec<models::ListedSandbox>> {
        let rt = Handle::current();
        rt.block_on(sandbox_async::Sandbox::list())
    }

    /// List all sandboxes with custom configuration
    pub fn list_with_config(config: Config) -> Result<Vec<models::ListedSandbox>> {
        let rt = Handle::current();
        rt.block_on(sandbox_async::Sandbox::list_with_config(config))
    }

    /// Get sandbox logs
    pub fn logs(&self) -> Result<Vec<models::SandboxLog>> {
        self.rt.block_on(self.inner.logs())
    }

    /// Create sandbox with metadata
    pub fn create_with_metadata(
        template_id: &str,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Result<Self> {
        let rt = Handle::current();
        let inner = rt.block_on(sandbox_async::Sandbox::create_with_metadata(template_id, metadata))?;
        Ok(Self { inner, rt })
    }

    /// Create sandbox with metadata and custom configuration
    pub fn create_with_metadata_and_config(
        template_id: &str,
        metadata: HashMap<String, serde_json::Value>,
        config: Config,
    ) -> Result<Self> {
        let rt = Handle::current();
        let inner = rt.block_on(sandbox_async::Sandbox::create_with_metadata_and_config(template_id, metadata, config))?;
        Ok(Self { inner, rt })
    }

    // Convenience methods that match Python SDK API
    
    /// Read a file as text
    pub fn read_text(&self, path: &str) -> Result<String> {
        self.rt.block_on(self.inner.read_text(path))
    }
    
    /// Write text to a file
    pub fn write_text(&self, path: &str, content: &str) -> Result<()> {
        self.rt.block_on(self.inner.write_text(path, content))
    }
    
    /// List files in a directory
    pub fn files_list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        self.rt.block_on(self.inner.files_list(path))
    }
    
    /// Check if a file exists
    pub fn files_exists(&self, path: &str) -> Result<bool> {
        self.rt.block_on(self.inner.files_exists(path))
    }
    
    /// Remove a file or directory
    pub fn files_remove(&self, path: &str) -> Result<()> {
        self.rt.block_on(self.inner.files_remove(path))
    }
    
    /// Create a directory
    pub fn files_make_dir(&self, path: &str) -> Result<()> {
        self.rt.block_on(self.inner.files_make_dir(path))
    }
    
    /// Rename/move a file or directory
    pub fn files_rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        self.rt.block_on(self.inner.files_rename(old_path, new_path))
    }
    
    /// Run a command and wait for completion
    pub fn run_command(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
        self.rt.block_on(self.inner.run_command(cmd, args))
    }
    
    /// List running processes
    pub fn processes_list(&self) -> Result<Vec<ProcessInfo>> {
        self.rt.block_on(self.inner.processes_list())
    }
    
    /// Kill a process by PID
    pub fn processes_kill(&self, pid: i32) -> Result<()> {
        self.rt.block_on(self.inner.processes_kill(pid))
    }
    
    /// List active PTY sessions
    pub fn pty_list(&self) -> Result<Vec<String>> {
        self.rt.block_on(self.inner.pty_list())
    }
    
    /// Kill a PTY session
    pub fn pty_kill(&self, pty_id: &str) -> Result<()> {
        self.rt.block_on(self.inner.pty_kill(pty_id))
    }
}

// Implement filesystem operations for sync Sandbox
impl Filesystem for Sandbox {
    fn list(&self, path: &str) -> Result<Vec<EntryInfo>> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.list(path))
    }
    
    fn read(&self, path: &str) -> Result<Vec<u8>> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.read(path))
    }
    
    fn write(&self, path: &str, data: &[u8]) -> Result<()> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.write(path, data))
    }
    
    fn write_multiple(&self, entries: &[WriteEntry]) -> Result<()> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.write_multiple(entries))
    }
    
    fn remove(&self, path: &str) -> Result<()> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.remove(path))
    }
    
    fn make_dir(&self, path: &str) -> Result<()> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.make_dir(path))
    }
    
    fn exists(&self, path: &str) -> Result<bool> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.exists(path))
    }
    
    fn rename(&self, old_path: &str, new_path: &str) -> Result<()> {
        use crate::filesystem::AsyncFilesystem;
        self.rt.block_on(self.inner.rename(old_path, new_path))
    }
    
    fn watch(&self, path: &str) -> Result<WatchHandle> {
        use crate::filesystem::AsyncFilesystem;
        use futures::stream::Stream;
        use std::pin::Pin;
        
        // For sync API, we need to convert async stream to sync handle
        // This is a placeholder - proper implementation would handle blocking conversion
        let async_handle = self.rt.block_on(self.inner.watch(path))?;
        let stream = Box::pin(futures::stream::empty()) as Pin<Box<dyn Stream<Item = Result<crate::filesystem::FilesystemEvent>> + Send>>;
        Ok(WatchHandle::new(stream))
    }
}

// Implement command operations for sync Sandbox
impl Commands for Sandbox {
    fn run(&self, cmd: &str, args: &[&str]) -> Result<CommandResult> {
        use crate::commands::AsyncCommands;
        self.rt.block_on(self.inner.run(cmd, args))
    }

    fn run_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<CommandResult> {
        use crate::commands::AsyncCommands;
        self.rt.block_on(self.inner.run_with_env(cmd, args, env))
    }

    fn run_with_cwd(&self, cmd: &str, args: &[&str], cwd: &str) -> Result<CommandResult> {
        use crate::commands::AsyncCommands;
        self.rt.block_on(self.inner.run_with_cwd(cmd, args, cwd))
    }

    fn run_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        timeout: Option<std::time::Duration>,
    ) -> Result<CommandResult> {
        use crate::commands::AsyncCommands;
        self.rt.block_on(self.inner.run_with_options(cmd, args, env, cwd, timeout))
    }

    fn start(&self, cmd: &str, args: &[&str]) -> Result<CommandHandle> {
        use crate::commands::AsyncCommands;
        use tokio::sync::mpsc;
        
        // For sync API, we need to convert async handle to sync handle
        // This is a placeholder - proper implementation would handle blocking conversion
        let async_handle = self.rt.block_on(self.inner.start(cmd, args))?;
        let (stdout_tx, stdout_rx) = mpsc::unbounded_channel();
        let (stderr_tx, stderr_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Ok(CommandHandle::new(async_handle.pid, stdout_rx, stderr_rx, exit_rx))
    }

    fn start_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<CommandHandle> {
        use crate::commands::AsyncCommands;
        use tokio::sync::mpsc;
        
        let async_handle = self.rt.block_on(self.inner.start_with_env(cmd, args, env))?;
        let (stdout_tx, stdout_rx) = mpsc::unbounded_channel();
        let (stderr_tx, stderr_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Ok(CommandHandle::new(async_handle.pid, stdout_rx, stderr_rx, exit_rx))
    }

    fn start_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
    ) -> Result<CommandHandle> {
        use crate::commands::AsyncCommands;
        use tokio::sync::mpsc;
        
        let async_handle = self.rt.block_on(self.inner.start_with_options(cmd, args, env, cwd))?;
        let (stdout_tx, stdout_rx) = mpsc::unbounded_channel();
        let (stderr_tx, stderr_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Ok(CommandHandle::new(async_handle.pid, stdout_rx, stderr_rx, exit_rx))
    }

    fn list(&self) -> Result<Vec<ProcessInfo>> {
        use crate::commands::AsyncCommands;
        self.rt.block_on(self.inner.list())
    }

    fn kill(&self, pid: i32) -> Result<()> {
        use crate::commands::AsyncCommands;
        self.rt.block_on(AsyncCommands::kill(&self.inner, pid))
    }
}

// Implement PTY operations for sync Sandbox
impl Pty for Sandbox {
    fn create(&self, cmd: &str, args: &[&str]) -> Result<PtyHandle> {
        use crate::pty::AsyncPty;
        use tokio::sync::mpsc;
        
        let async_handle = self.rt.block_on(self.inner.create(cmd, args))?;
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Ok(PtyHandle::new(async_handle.pid, async_handle.pty_id, output_rx, exit_rx))
    }

    fn create_with_env(&self, cmd: &str, args: &[&str], env: &HashMap<String, String>) -> Result<PtyHandle> {
        use crate::pty::AsyncPty;
        use tokio::sync::mpsc;
        
        let async_handle = self.rt.block_on(self.inner.create_with_env(cmd, args, env))?;
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Ok(PtyHandle::new(async_handle.pid, async_handle.pty_id, output_rx, exit_rx))
    }

    fn create_with_options(
        &self,
        cmd: &str,
        args: &[&str],
        env: Option<&HashMap<String, String>>,
        cwd: Option<&str>,
        size: Option<PtySize>,
    ) -> Result<PtyHandle> {
        use crate::pty::AsyncPty;
        use tokio::sync::mpsc;
        
        let async_handle = self.rt.block_on(self.inner.create_with_options(cmd, args, env, cwd, size))?;
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel();
        
        Ok(PtyHandle::new(async_handle.pid, async_handle.pty_id, output_rx, exit_rx))
    }

    fn list(&self) -> Result<Vec<String>> {
        use crate::pty::AsyncPty;
        self.rt.block_on(self.inner.list())
    }

    fn kill(&self, pty_id: &str) -> Result<()> {
        use crate::pty::AsyncPty;
        self.rt.block_on(AsyncPty::kill(&self.inner, pty_id))
    }
}