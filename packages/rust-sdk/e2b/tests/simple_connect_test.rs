use std::env;
use e2b::{AsyncSandbox, AsyncCommands};

#[tokio::test]
async fn test_simple_sandbox_creation() -> Result<(), Box<dyn std::error::Error>> {
    // Set up comprehensive tracing
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_test_writer()
        .try_init();
    
    // Set the API key and domain
    env::set_var("E2B_API_KEY", "e2b_8243fedef2860914c837777fb42cf5f13e3d23c8");
    env::set_var("E2B_DOMAIN", "https://api.e2b.app");
    
    tracing::info!("Creating E2B sandbox...");
    
    // Try with the default template
    let sandbox = AsyncSandbox::create("base").await?;
    tracing::info!("✅ Sandbox created: {}", sandbox.id);
    
    // Get sandbox info
    let info = sandbox.info().await?;
    tracing::info!("📋 Sandbox info: ID={}, Template={}, State={:?}", 
                  info.sandbox_id, info.template_id, info.state);
    
    // Wait a bit for the sandbox envd service to be ready
    tracing::info!("Waiting for sandbox to be fully ready...");
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    // Test a simple command that should work quickly
    tracing::info!("Running simple command: echo 'Hello World'");
    
    let result = sandbox.commands.run("echo", &["Hello World"]).await?;
    tracing::info!("✅ Command result: exit_code={}, stdout='{}'", result.exit_code, result.stdout.trim());
    
    // Clean up
    tracing::info!("Cleaning up sandbox...");
    //sandbox.close().await?;
    tracing::info!("✅ Test completed successfully");
    
    Ok(())
}
