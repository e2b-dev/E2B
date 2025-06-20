use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Authentication failed: {message}")]
    Authentication { message: String },

    #[error("Not found: {message}")]
    NotFound { message: String },

    #[error("Invalid argument: {message}")]
    InvalidArgument { message: String },

    #[error("Timeout: {message}")]
    Timeout { message: String },

    #[error("Template error: {message}")]
    Template { message: String },

    #[error("Not enough space: {message}")]
    NotEnoughSpace { message: String },

    #[error("Rate limit exceeded: {message}")]
    RateLimit { message: String },

    #[error("Network error: {source}")]
    Network {
        #[from]
        source: reqwest::Error,
    },

    #[error("RPC error: {source}")]
    Rpc {
        #[from]
        source: tonic::Status,
    },

    #[error("Serialization error: {source}")]
    Serialization {
        #[from]
        source: serde_json::Error,
    },

    #[error("Configuration error: {source}")]
    Config {
        #[from]
        source: config::ConfigError,
    },

    #[error("IO error: {source}")]
    Io {
        #[from]
        source: std::io::Error,
    },

    #[error("Internal error: {message}")]
    Internal { message: String },

    #[error("Other error: {message}")]
    Other { message: String },
}

impl Error {
    pub fn authentication<S: Into<String>>(message: S) -> Self {
        Self::Authentication {
            message: message.into(),
        }
    }

    pub fn not_found<S: Into<String>>(message: S) -> Self {
        Self::NotFound {
            message: message.into(),
        }
    }

    pub fn invalid_argument<S: Into<String>>(message: S) -> Self {
        Self::InvalidArgument {
            message: message.into(),
        }
    }

    pub fn timeout<S: Into<String>>(message: S) -> Self {
        Self::Timeout {
            message: message.into(),
        }
    }

    pub fn template<S: Into<String>>(message: S) -> Self {
        Self::Template {
            message: message.into(),
        }
    }

    pub fn not_enough_space<S: Into<String>>(message: S) -> Self {
        Self::NotEnoughSpace {
            message: message.into(),
        }
    }

    pub fn rate_limit<S: Into<String>>(message: S) -> Self {
        Self::RateLimit {
            message: message.into(),
        }
    }

    pub fn internal<S: Into<String>>(message: S) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    pub fn other<S: Into<String>>(message: S) -> Self {
        Self::Other {
            message: message.into(),
        }
    }
}