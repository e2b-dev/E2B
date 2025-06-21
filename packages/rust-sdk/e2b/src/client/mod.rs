pub mod models;

use crate::{config::Config, error::Result};
use reqwest::{Client, RequestBuilder};
use serde::de::DeserializeOwned;
use std::time::Duration;
use url::Url;

#[derive(Debug, Clone)]
pub struct ApiClient {
    pub client: Client,
    pub config: Config,
}

impl ApiClient {
    pub fn new(config: Config) -> Result<Self> {
        let client = Client::builder()
            .timeout(config.timeout)
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .build()?;

        Ok(Self { client, config })
    }

    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        self.client
            .get(url)
            .header("X-API-KEY", &self.config.api_key)
    }

    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        self.client
            .post(url)
            .header("X-API-KEY", &self.config.api_key)
    }

    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        self.client
            .delete(url)
            .header("X-API-KEY", &self.config.api_key)
    }

    pub async fn send_json<T: DeserializeOwned>(&self, request: RequestBuilder) -> Result<T> {
        let response = request.send().await?;
        
        if response.status().is_success() {
            let json = response.json().await?;
            Ok(json)
        } else {
            let status = response.status();
            let bytes = response.bytes().await.unwrap_or_default();
            
            if let Ok(api_error) = serde_json::from_slice::<models::ApiError>(&bytes) {
                Err(self.map_api_error(status.as_u16(), &api_error))
            } else {
                let text = String::from_utf8_lossy(&bytes);
                Err(self.map_http_error(status.as_u16(), &text))
            }
        }
    }

    pub async fn send_empty(&self, request: RequestBuilder) -> Result<()> {
        let response = request.send().await?;
        
        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let bytes = response.bytes().await.unwrap_or_default();
            
            if let Ok(api_error) = serde_json::from_slice::<models::ApiError>(&bytes) {
                Err(self.map_api_error(status.as_u16(), &api_error))
            } else {
                let text = String::from_utf8_lossy(&bytes);
                Err(self.map_http_error(status.as_u16(), &text))
            }
        }
    }

    fn build_url(&self, path: &str) -> Url {
        let path = if path.starts_with('/') { path } else { &format!("/{}", path) };
        self.config.domain.join(path).expect("Invalid URL path")
    }

    fn map_api_error(&self, status: u16, api_error: &models::ApiError) -> crate::error::Error {
        match status {
            401 => crate::error::Error::authentication(&api_error.message),
            404 => crate::error::Error::not_found(&api_error.message),
            400 => crate::error::Error::invalid_argument(&api_error.message),
            408 => crate::error::Error::timeout(&api_error.message),
            413 => crate::error::Error::not_enough_space(&api_error.message),
            429 => crate::error::Error::rate_limit(&api_error.message),
            _ => crate::error::Error::internal(format!("API Error {}: {}", api_error.code, api_error.message)),
        }
    }

    fn map_http_error(&self, status: u16, message: &str) -> crate::error::Error {
        match status {
            401 => crate::error::Error::authentication(message),
            404 => crate::error::Error::not_found(message),
            400 => crate::error::Error::invalid_argument(message),
            408 => crate::error::Error::timeout(message),
            413 => crate::error::Error::not_enough_space(message),
            429 => crate::error::Error::rate_limit(message),
            _ => crate::error::Error::internal(format!("HTTP {}: {}", status, message)),
        }
    }
}