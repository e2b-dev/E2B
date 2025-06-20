#!/usr/bin/env cargo +nightly -Zscript
//! Test script for Connect RPC implementation
//! Run with: cargo +nightly -Zscript test_connect_rpc.rs

//```cargo
//[dependencies]
//tokio = { version = "1.0", features = ["full"] }
//e2b = { path = "./e2b" }
//tracing = "0.1"
//tracing-subscriber = "0.3"
//```

use std::env;
use tokio;
use tracing;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    // Set the API key
    env::set_var("E2B_API_KEY", "e2b_8243fedef2860914c837777fb42cf5f13e3d23c8");
    
    println!("Creating E2B sandbox with Connect RPC client...");
    
    // TODO: Create sandbox instance and test Connect RPC functionality
    // This would require implementing the sandbox creation and Connect RPC integration
    
    println!("Connect RPC test completed!");
    
    Ok(())
}