use serde::{Deserialize, Serialize};
use futures::stream::Stream;
use std::pin::Pin;
use std::task::{Context, Poll};
use crate::error::{Error, Result};

/// File type enumeration matching Python SDK
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    #[serde(rename = "file")]
    File,
    #[serde(rename = "dir")]
    Dir,
}

/// Filesystem entry information matching Python SDK EntryInfo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryInfo {
    pub name: String,
    pub r#type: Option<FileType>,
    pub path: String,
}

/// Write entry for batch file operations
#[derive(Debug, Clone)]
pub struct WriteEntry {
    pub path: String,
    pub data: Vec<u8>,
}

impl WriteEntry {
    pub fn new(path: impl Into<String>, data: impl Into<Vec<u8>>) -> Self {
        Self {
            path: path.into(),
            data: data.into(),
        }
    }
    
    pub fn from_str(path: impl Into<String>, content: &str) -> Self {
        Self {
            path: path.into(),
            data: content.as_bytes().to_vec(),
        }
    }
}

/// Filesystem event type enumeration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FilesystemEventType {
    Chmod,
    Create,
    Remove,
    Rename,
    Write,
}

/// Filesystem event information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesystemEvent {
    pub name: String,
    pub r#type: FilesystemEventType,
}

/// Handle for watching filesystem changes
pub struct WatchHandle {
    _inner: Pin<Box<dyn Stream<Item = Result<FilesystemEvent>> + Send>>,
}

impl WatchHandle {
    pub fn new(stream: Pin<Box<dyn Stream<Item = Result<FilesystemEvent>> + Send>>) -> Self {
        Self { _inner: stream }
    }
}

/// Async handle for watching filesystem changes
pub struct AsyncWatchHandle {
    inner: Pin<Box<dyn Stream<Item = Result<FilesystemEvent>> + Send>>,
}

impl AsyncWatchHandle {
    pub fn new(stream: Pin<Box<dyn Stream<Item = Result<FilesystemEvent>> + Send>>) -> Self {
        Self { inner: stream }
    }
}

impl Stream for AsyncWatchHandle {
    type Item = Result<FilesystemEvent>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.inner.as_mut().poll_next(cx)
    }
}

/// Filesystem operations trait for async implementation
#[async_trait::async_trait]
pub trait AsyncFilesystem {
    /// List directory contents
    async fn list(&self, path: &str) -> Result<Vec<EntryInfo>>;
    
    /// Read file contents as bytes
    async fn read(&self, path: &str) -> Result<Vec<u8>>;
    
    /// Read file contents as string
    async fn read_text(&self, path: &str) -> Result<String> {
        let bytes = self.read(path).await?;
        String::from_utf8(bytes).map_err(|e| Error::invalid_argument(format!("Invalid UTF-8: {}", e)))
    }
    
    /// Write bytes to file
    async fn write(&self, path: &str, data: &[u8]) -> Result<()>;
    
    /// Write string to file
    async fn write_text(&self, path: &str, content: &str) -> Result<()> {
        self.write(path, content.as_bytes()).await
    }
    
    /// Write multiple files
    async fn write_multiple(&self, entries: &[WriteEntry]) -> Result<()>;
    
    /// Remove file or directory
    async fn remove(&self, path: &str) -> Result<()>;
    
    /// Create directory
    async fn make_dir(&self, path: &str) -> Result<()>;
    
    /// Check if file/directory exists
    async fn exists(&self, path: &str) -> Result<bool>;
    
    /// Rename/move file or directory
    async fn rename(&self, old_path: &str, new_path: &str) -> Result<()>;
    
    /// Watch filesystem for changes
    async fn watch(&self, path: &str) -> Result<AsyncWatchHandle>;
}

/// Filesystem operations trait for sync implementation
pub trait Filesystem {
    /// List directory contents
    fn list(&self, path: &str) -> Result<Vec<EntryInfo>>;
    
    /// Read file contents as bytes
    fn read(&self, path: &str) -> Result<Vec<u8>>;
    
    /// Read file contents as string
    fn read_text(&self, path: &str) -> Result<String> {
        let bytes = self.read(path)?;
        String::from_utf8(bytes).map_err(|e| Error::invalid_argument(format!("Invalid UTF-8: {}", e)))
    }
    
    /// Write bytes to file
    fn write(&self, path: &str, data: &[u8]) -> Result<()>;
    
    /// Write string to file
    fn write_text(&self, path: &str, content: &str) -> Result<()> {
        self.write(path, content.as_bytes())
    }
    
    /// Write multiple files
    fn write_multiple(&self, entries: &[WriteEntry]) -> Result<()>;
    
    /// Remove file or directory
    fn remove(&self, path: &str) -> Result<()>;
    
    /// Create directory
    fn make_dir(&self, path: &str) -> Result<()>;
    
    /// Check if file/directory exists
    fn exists(&self, path: &str) -> Result<bool>;
    
    /// Rename/move file or directory
    fn rename(&self, old_path: &str, new_path: &str) -> Result<()>;
    
    /// Watch filesystem for changes
    fn watch(&self, path: &str) -> Result<WatchHandle>;
}