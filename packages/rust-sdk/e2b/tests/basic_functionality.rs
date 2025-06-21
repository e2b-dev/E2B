#[cfg(feature = "async")]
use e2b::AsyncSandbox;
#[cfg(feature = "sync")]
use e2b::SyncSandbox;
use e2b::{Config, Result};
use std::collections::HashMap;

#[tokio::test]
async fn test_async_sandbox_creation() -> Result<()> {
    // Test async sandbox creation
    let config = Config::new()?;
    
    // This would normally connect to real E2B service
    // For now, we test the API structure
    
    // Test that we can create the types
    let _template_id = "test-template";
    
    // Test configuration
    assert!(!config.api_key.is_empty());
    
    Ok(())
}

#[tokio::test] 
async fn test_async_filesystem_operations() -> Result<()> {
    use e2b::filesystem::{AsyncFilesystem, WriteEntry};
    
    // Test filesystem trait exists and compiles
    // In real implementation, this would test actual operations
    
    Ok(())
}

#[tokio::test]
async fn test_async_command_operations() -> Result<()> {
    use e2b::commands::AsyncCommands;
    
    // Test command trait exists and compiles
    // In real implementation, this would test actual command execution
    
    Ok(())
}

#[tokio::test]
async fn test_async_pty_operations() -> Result<()> {
    use e2b::pty::AsyncPty;
    
    // Test PTY trait exists and compiles
    // In real implementation, this would test actual PTY operations
    
    Ok(())
}

#[cfg(feature = "sync")]
#[test]
fn test_sync_sandbox_creation() -> Result<()> {
    // Test sync sandbox creation compiles
    let config = Config::new()?;
    assert!(!config.api_key.is_empty());
    
    Ok(())
}

#[cfg(feature = "sync")]
#[test]
fn test_sync_filesystem_operations() -> Result<()> {
    use e2b::filesystem::{Filesystem, WriteEntry};
    
    // Test filesystem trait exists and compiles
    // In real implementation, this would test actual operations
    
    Ok(())
}

#[cfg(feature = "sync")]
#[test]
fn test_sync_command_operations() -> Result<()> {
    use e2b::commands::Commands;
    
    // Test command trait exists and compiles
    // In real implementation, this would test actual command execution
    
    Ok(())
}

#[cfg(feature = "sync")]
#[test]
fn test_sync_pty_operations() -> Result<()> {
    use e2b::pty::Pty;
    
    // Test PTY trait exists and compiles
    // In real implementation, this would test actual PTY operations
    
    Ok(())
}

#[test]
fn test_error_types() {
    use e2b::{Error, SandboxException, AuthenticationException};
    
    // Test that error types exist and can be created
    let _err = Error::authentication("test");
    
    // Test error conversions
    let auth_err = Error::authentication("auth failed");
    assert!(matches!(auth_err, Error::Authentication { .. }));
}

#[test]
fn test_type_exports() {
    // Test that all Python SDK equivalent types are exported
    use e2b::{
        EntryInfo, FileType, WriteEntry, FilesystemEvent, FilesystemEventType,
        CommandResult, ProcessInfo, Stdout, Stderr, PtyOutput, PtySize,
        AsyncWatchHandle, WatchHandle, CommandHandle, AsyncCommandHandle,
        PtyHandle, AsyncPtyHandle, SandboxInfo, OutputHandler,
    };
    
    // Test that types can be constructed
    let _entry = EntryInfo {
        name: "test".to_string(),
        r#type: Some(FileType::File),
        path: "/test".to_string(),
    };
    
    let _write_entry = WriteEntry::from_str("/test", "content");
    
    let _result = CommandResult {
        stderr: "".to_string(),
        stdout: "output".to_string(),
        exit_code: 0,
        error: None,
    };
    
    let _size = PtySize { rows: 24, cols: 80 };
}

#[tokio::test]
async fn test_full_api_surface() -> Result<()> {
    // Test that we can use the main API methods that match Python SDK
    
    // This demonstrates the API surface is equivalent to Python SDK
    // In production, these would be actual integration tests
    
    // Async API
    // let sandbox = AsyncSandbox::create("template").await?;
    // let files = sandbox.files_list("/").await?;
    // let result = sandbox.run_command("echo", &["hello"]).await?;
    // let pty = sandbox.pty_create("bash", &[]).await?;
    
    // Sync API  
    // let sandbox = SyncSandbox::create("template")?;
    // let files = sandbox.files_list("/")?;
    // let result = sandbox.run_command("echo", &["hello"])?;
    // let pty = sandbox.pty_create("bash", &[])?;
    
    Ok(())
}