use std::env;
use reqwest;

#[tokio::test]
async fn test_direct_connect_request() -> Result<(), Box<dyn std::error::Error>> {
    // Set up environment
    env::set_var("E2B_API_KEY", "e2b_8243fedef2860914c837777fb42cf5f13e3d23c8");
    env::set_var("E2B_DOMAIN", "https://api.e2b.app");
    
    // Create a test sandbox first
    use e2b::AsyncSandbox;
    let sandbox = AsyncSandbox::create("base").await?;
    println!("✅ Sandbox created: {}", sandbox.id);
    
    // Try making a direct Connect RPC request with port prefix
    let connect_url = format!("https://49983-{}.e2b.app/process.Process/List", sandbox.id);
    println!("🔗 Testing direct Connect URL: {}", connect_url);
    
    let client = reqwest::Client::new();
    let api_key = env::var("E2B_API_KEY")?;
    
    let response = client
        .post(&connect_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("connect-protocol-version", "1")
        .header("content-type", "application/json")
        .json(&serde_json::json!({}))
        .send()
        .await?;
        
    println!("📡 Response status: {}", response.status());
    println!("📡 Response headers: {:?}", response.headers());
    
    let text = response.text().await?;
    println!("📡 Response body: {}", text);
    
    // Clean up
    sandbox.close().await?;
    
    Ok(())
}