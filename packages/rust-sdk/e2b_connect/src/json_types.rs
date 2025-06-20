//! JSON-compatible types for Connect RPC
//!
//! These types mirror the protobuf definitions but with serde serialization support
//! for use with the Connect RPC protocol's JSON encoding.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Filesystem types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListDirRequest {
    pub path: String,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListDirResponse {
    pub entries: Vec<EntryInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatResponse {
    pub entry: Option<EntryInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MakeDirRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MakeDirResponse {
    pub entry: Option<EntryInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveResponse {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveRequest {
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveResponse {
    pub entry: Option<EntryInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: i32,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[repr(i32)]
pub enum FileType {
    Unspecified = 0,
    File = 1,
    Directory = 2,
}

// Process types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResponse {
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub tag: String,
    pub config: Option<ProcessConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessConfig {
    pub cmd: String,
    pub args: Vec<String>,
    pub envs: HashMap<String, String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendSignalRequest {
    pub process: Option<ProcessSelector>,
    pub signal: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendSignalResponse {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSelector {
    pub selector: Option<ProcessSelectorType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ProcessSelectorType {
    Pid { pid: u32 },
    Tag { tag: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[repr(i32)]
pub enum Signal {
    Sigkill = 9,
    Sigterm = 15,
    Sigint = 2,
}

// Streaming types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartRequest {
    pub process: ProcessConfig,  // Required field in protobuf
    pub pty: Option<Pty>,
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartResponse {
    pub event: ProcessEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessEvent {
    // In protobuf-to-JSON conversion, oneof fields become direct fields
    pub start: Option<StartEvent>,
    pub data: Option<DataEvent>, 
    pub end: Option<EndEvent>,
    #[serde(rename = "keepalive")]
    pub keep_alive: Option<ProcessKeepAliveEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartEvent {
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataEvent {
    // In protobuf-to-JSON, oneof fields become direct optional fields
    // The bytes are base64-encoded in JSON
    #[serde(with = "base64_option")]
    pub stdout: Option<Vec<u8>>,
    #[serde(with = "base64_option")]
    pub stderr: Option<Vec<u8>>,
    #[serde(with = "base64_option")]
    pub pty: Option<Vec<u8>>,
}

mod base64_option {
    use serde::{Deserialize, Deserializer, Serializer};
    
    pub fn serialize<S>(value: &Option<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(bytes) => {
                let encoded = base64::encode(bytes);
                serializer.serialize_some(&encoded)
            }
            None => serializer.serialize_none(),
        }
    }
    
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Vec<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt: Option<String> = Option::deserialize(deserializer)?;
        match opt {
            Some(s) => {
                base64::decode(&s)
                    .map(Some)
                    .map_err(serde::de::Error::custom)
            }
            None => Ok(None),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndEvent {
    pub exit_code: i32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pty {
    pub size: Option<PtySize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySize {
    pub cols: u32,
    pub rows: u32,
}

// Filesystem streaming types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchDirRequest {
    pub path: String,
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchDirResponse {
    pub event: Option<WatchEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum WatchEvent {
    Start { start: WatchStartEvent },
    Filesystem { filesystem: FilesystemEvent },
    KeepAlive { keepalive: ProcessKeepAliveEvent },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchStartEvent {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesystemEvent {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessKeepAliveEvent {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[repr(i32)]
pub enum FilesystemEventType {
    Unspecified = 0,
    Create = 1,
    Write = 2,
    Remove = 3,
    Rename = 4,
    Chmod = 5,
}

// Conversion functions to/from protobuf types
impl From<crate::filesystem::ListDirRequest> for ListDirRequest {
    fn from(req: crate::filesystem::ListDirRequest) -> Self {
        Self {
            path: req.path,
            depth: req.depth,
        }
    }
}

impl From<ListDirResponse> for crate::filesystem::ListDirResponse {
    fn from(resp: ListDirResponse) -> Self {
        Self {
            entries: resp.entries.into_iter().map(|e| crate::filesystem::EntryInfo {
                name: e.name,
                r#type: e.r#type,
                path: e.path,
            }).collect(),
        }
    }
}

impl From<crate::filesystem::StatRequest> for StatRequest {
    fn from(req: crate::filesystem::StatRequest) -> Self {
        Self { path: req.path }
    }
}

impl From<StatResponse> for crate::filesystem::StatResponse {
    fn from(resp: StatResponse) -> Self {
        Self {
            entry: resp.entry.map(|e| crate::filesystem::EntryInfo {
                name: e.name,
                r#type: e.r#type,
                path: e.path,
            }),
        }
    }
}

impl From<crate::filesystem::MakeDirRequest> for MakeDirRequest {
    fn from(req: crate::filesystem::MakeDirRequest) -> Self {
        Self { path: req.path }
    }
}

impl From<MakeDirResponse> for crate::filesystem::MakeDirResponse {
    fn from(resp: MakeDirResponse) -> Self {
        Self {
            entry: resp.entry.map(|e| crate::filesystem::EntryInfo {
                name: e.name,
                r#type: e.r#type,
                path: e.path,
            }),
        }
    }
}

impl From<crate::filesystem::RemoveRequest> for RemoveRequest {
    fn from(req: crate::filesystem::RemoveRequest) -> Self {
        Self { path: req.path }
    }
}

impl From<RemoveResponse> for crate::filesystem::RemoveResponse {
    fn from(_resp: RemoveResponse) -> Self {
        Self {}
    }
}

impl From<crate::filesystem::MoveRequest> for MoveRequest {
    fn from(req: crate::filesystem::MoveRequest) -> Self {
        Self {
            source: req.source,
            destination: req.destination,
        }
    }
}

impl From<MoveResponse> for crate::filesystem::MoveResponse {
    fn from(resp: MoveResponse) -> Self {
        Self {
            entry: resp.entry.map(|e| crate::filesystem::EntryInfo {
                name: e.name,
                r#type: e.r#type,
                path: e.path,
            }),
        }
    }
}

// Process conversions
impl From<crate::process::ListRequest> for ListRequest {
    fn from(_req: crate::process::ListRequest) -> Self {
        Self {}
    }
}

impl From<ListResponse> for crate::process::ListResponse {
    fn from(resp: ListResponse) -> Self {
        Self {
            processes: resp.processes.into_iter().map(|p| crate::process::ProcessInfo {
                pid: p.pid,
                tag: Some(p.tag),
                config: p.config.map(|c| crate::process::ProcessConfig {
                    cmd: c.cmd,
                    args: c.args,
                    envs: c.envs,
                    cwd: c.cwd,
                }),
            }).collect(),
        }
    }
}

impl From<crate::process::SendSignalRequest> for SendSignalRequest {
    fn from(req: crate::process::SendSignalRequest) -> Self {
        Self {
            process: req.process.map(|sel| ProcessSelector {
                selector: match sel.selector {
                    Some(crate::process::process_selector::Selector::Pid(pid)) => {
                        Some(ProcessSelectorType::Pid { pid })
                    }
                    Some(crate::process::process_selector::Selector::Tag(tag)) => {
                        Some(ProcessSelectorType::Tag { tag })
                    }
                    None => None,
                }
            }),
            signal: req.signal,
        }
    }
}

impl From<SendSignalResponse> for crate::process::SendSignalResponse {
    fn from(_resp: SendSignalResponse) -> Self {
        Self {}
    }
}