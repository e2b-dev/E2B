//! E2B Connect RPC client for Rust
//!
//! This crate provides both gRPC clients and Connect RPC clients for E2B's filesystem and process services,
//! generated from the protobuf definitions.

pub mod filesystem {
    tonic::include_proto!("filesystem");
}

pub mod process {
    tonic::include_proto!("process");
}

// Connect RPC implementation (HTTP-based RPC protocol used by E2B)
pub mod connect;
pub mod json_types;
