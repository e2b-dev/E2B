use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api_key: String,
    pub domain: Url,
    pub timeout: Duration,
    pub debug: bool,
}

impl Config {
    pub fn new() -> Result<Self> {
        let api_key = std::env::var("E2B_API_KEY")
            .map_err(|_| Error::authentication("E2B_API_KEY environment variable is required"))?;

        let domain = std::env::var("E2B_DOMAIN")
            .unwrap_or_else(|_| "https://api.e2b.dev".to_string())
            .parse()
            .map_err(|e| Error::invalid_argument(format!("Invalid E2B_DOMAIN URL: {}", e)))?;

        let timeout_seconds = std::env::var("E2B_TIMEOUT")
            .unwrap_or_else(|_| "30".to_string())
            .parse::<u64>()
            .map_err(|e| Error::invalid_argument(format!("Invalid E2B_TIMEOUT: {}", e)))?;

        let debug = std::env::var("E2B_DEBUG")
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or(false);

        Ok(Config {
            api_key,
            domain,
            timeout: Duration::from_secs(timeout_seconds),
            debug,
        })
    }

    pub fn with_api_key<S: Into<String>>(mut self, api_key: S) -> Self {
        self.api_key = api_key.into();
        self
    }

    pub fn with_domain(mut self, domain: Url) -> Self {
        self.domain = domain;
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn with_debug(mut self, debug: bool) -> Self {
        self.debug = debug;
        self
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::new().expect("Failed to create default config")
    }
}