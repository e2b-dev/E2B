pub mod config;
pub mod error;

#[cfg(feature = "async")]
pub mod sandbox_async;

#[cfg(feature = "sync")]
pub mod sandbox_sync;

pub mod client;
pub mod filesystem;
pub mod commands;
pub mod pty;
pub mod envd;
pub mod vnc;

// Re-exports for convenience matching Python SDK exports
pub use config::Config;
pub use error::{Error, Result};

// Sandbox exports
#[cfg(feature = "async")]
pub use sandbox_async::Sandbox as AsyncSandbox;

#[cfg(feature = "sync")]
pub use sandbox_sync::Sandbox as SyncSandbox;

// Default export based on features
#[cfg(all(feature = "async", not(feature = "sync")))]
pub use sandbox_async::Sandbox;

#[cfg(all(feature = "sync", not(feature = "async")))]
pub use sandbox_sync::Sandbox;

#[cfg(all(feature = "sync", feature = "async"))]
pub use sandbox_sync::Sandbox;

// Filesystem exports
pub use filesystem::{
    AsyncFilesystem, Filesystem, EntryInfo, FileType, WriteEntry,
    FilesystemEvent, FilesystemEventType, AsyncWatchHandle, WatchHandle,
};

// Command exports  
pub use commands::{
    AsyncCommands, Commands, CommandResult, CommandHandle, AsyncCommandHandle,
    ProcessInfo, Stdout, Stderr, PtyOutput, PtySize, CommandExitException,
};

// PTY exports
pub use pty::{AsyncPty, Pty, PtyHandle, AsyncPtyHandle};

// VNC exports
pub use vnc::{VncServer, VncConfig, VncUrlOptions};

// Client exports
pub use client::{ApiClient, models};

// Error exports matching Python SDK
pub use error::{
    Error as SandboxException,
    Error as TimeoutException,
    Error as NotFoundException, 
    Error as AuthenticationException,
    Error as InvalidArgumentException,
    Error as NotEnoughSpaceException,
    Error as TemplateException,
};

// Output handler type for compatibility
pub type OutputHandler = Box<dyn Fn(&str) + Send + Sync>;

// Sandbox info type alias 
pub use client::models::SandboxDetail as SandboxInfo;