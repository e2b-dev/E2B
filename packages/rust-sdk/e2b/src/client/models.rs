use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSandbox {
    #[serde(rename = "templateID")]
    pub template_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(rename = "envVars", skip_serializing_if = "Option::is_none")]
    pub env_vars: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
    #[serde(default = "default_false", skip_serializing_if = "is_false")]
    pub auto_pause: bool,
    #[serde(default = "default_false", skip_serializing_if = "is_false")]
    pub secure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sandbox {
    #[serde(rename = "clientID")]
    pub client_id: String,
    #[serde(rename = "sandboxID")]
    pub sandbox_id: String,
    #[serde(rename = "templateID")]
    pub template_id: String,
    #[serde(rename = "envdVersion")]
    pub envd_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    #[serde(rename = "envdAccessToken", skip_serializing_if = "Option::is_none")]
    pub envd_access_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedSandbox {
    #[serde(rename = "clientID")]
    pub client_id: String,
    #[serde(rename = "sandboxID")]
    pub sandbox_id: String,
    #[serde(rename = "templateID")]
    pub template_id: String,
    #[serde(rename = "cpuCount")]
    pub cpu_count: u32,
    #[serde(rename = "memoryMB")]
    pub memory_mb: u32,
    #[serde(rename = "startedAt")]
    pub started_at: DateTime<Utc>,
    #[serde(rename = "endAt")]
    pub end_at: DateTime<Utc>,
    pub state: SandboxState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxDetail {
    #[serde(rename = "clientID")]
    pub client_id: String,
    #[serde(rename = "sandboxID")]
    pub sandbox_id: String,
    #[serde(rename = "templateID")]
    pub template_id: String,
    #[serde(rename = "cpuCount")]
    pub cpu_count: u32,
    #[serde(rename = "memoryMB")]
    pub memory_mb: u32,
    #[serde(rename = "startedAt")]
    pub started_at: DateTime<Utc>,
    #[serde(rename = "endAt")]
    pub end_at: DateTime<Utc>,
    pub state: SandboxState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(rename = "envdVersion", skip_serializing_if = "Option::is_none")]
    pub envd_version: Option<String>,
    #[serde(rename = "envdAccessToken", skip_serializing_if = "Option::is_none")]
    pub envd_access_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SandboxState {
    Running,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxLog {
    pub timestamp: DateTime<Utc>,
    pub line: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxLogs {
    pub logs: Vec<SandboxLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: u32,
    pub message: String,
}

fn default_false() -> bool {
    false
}

fn is_false(b: &bool) -> bool {
    !b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_sandbox_serialization() {
        let new_sandbox = NewSandbox {
            template_id: "base".to_string(),
            alias: None,
            metadata: None,
            env_vars: None,
            timeout: None,
            auto_pause: false,
            secure: false,
        };

        let json = serde_json::to_string(&new_sandbox).unwrap();
        assert!(json.contains("\"templateID\":\"base\""));
        assert!(!json.contains("alias"));
        assert!(!json.contains("autoPause"));
        assert!(!json.contains("secure"));
    }

    #[test]
    fn test_sandbox_state_serialization() {
        let running = SandboxState::Running;
        let paused = SandboxState::Paused;

        assert_eq!(serde_json::to_string(&running).unwrap(), "\"running\"");
        assert_eq!(serde_json::to_string(&paused).unwrap(), "\"paused\"");
    }

    #[test]
    fn test_api_error_deserialization() {
        let json = r#"{"code": 404, "message": "Sandbox not found"}"#;
        let error: ApiError = serde_json::from_str(json).unwrap();
        
        assert_eq!(error.code, 404);
        assert_eq!(error.message, "Sandbox not found");
    }

    #[test]
    fn test_listed_sandbox_deserialization() {
        let json = r#"{
            "clientID": "client-123",
            "sandboxID": "sandbox-456", 
            "templateID": "base",
            "cpuCount": 2,
            "memoryMB": 1024,
            "startedAt": "2024-01-01T00:00:00Z",
            "endAt": "2024-01-01T01:00:00Z",
            "state": "running"
        }"#;
        
        let sandbox: ListedSandbox = serde_json::from_str(json).unwrap();
        assert_eq!(sandbox.client_id, "client-123");
        assert_eq!(sandbox.sandbox_id, "sandbox-456");
        assert_eq!(sandbox.template_id, "base");
        assert_eq!(sandbox.cpu_count, 2);
        assert_eq!(sandbox.memory_mb, 1024);
        assert!(matches!(sandbox.state, SandboxState::Running));
    }
}