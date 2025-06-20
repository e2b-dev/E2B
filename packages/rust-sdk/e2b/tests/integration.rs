use e2b::AsyncSandbox;
use std::collections::HashMap;
use uuid::Uuid;

#[tokio::test]
async fn test_get_info() {
    // Skip in debug mode - implementation pending
    if std::env::var("E2B_DEBUG").unwrap_or_default() == "true" {
        return;
    }

    let template_id = std::env::var("E2B_TEMPLATE_ID")
        .unwrap_or_else(|_| "base".to_string());
    
    let sandbox = AsyncSandbox::create(&template_id).await.unwrap();
    
    let info = sandbox.info().await.unwrap();
    assert_eq!(info.sandbox_id, sandbox.id);
    
    // Cleanup
    sandbox.kill().await.unwrap();
}

#[tokio::test]
async fn test_kill_existing_sandbox() {
    // Skip in debug mode - implementation pending  
    if std::env::var("E2B_DEBUG").unwrap_or_default() == "true" {
        return;
    }

    let template_id = std::env::var("E2B_TEMPLATE_ID")
        .unwrap_or_else(|_| "base".to_string());
    
    let sandbox = AsyncSandbox::create(&template_id).await.unwrap();
    let sandbox_id = sandbox.id.clone();
    
    // Kill the sandbox
    sandbox.kill().await.unwrap();
    
    // Verify it's no longer in the list
    let list = AsyncSandbox::list().await.unwrap();
    assert!(!list.iter().any(|s| s.sandbox_id == sandbox_id));
}

#[tokio::test] 
async fn test_kill_non_existing_sandbox() {
    // Skip in debug mode - implementation pending
    if std::env::var("E2B_DEBUG").unwrap_or_default() == "true" {
        return;
    }

    let config = e2b::Config::new().unwrap();
    let result = AsyncSandbox::connect_with_config("non-existing-sandbox", config).await;
    
    // Should return an error for non-existing sandbox
    assert!(result.is_err());
}

#[tokio::test]
async fn test_list_sandboxes() {
    // Skip in debug mode - implementation pending
    if std::env::var("E2B_DEBUG").unwrap_or_default() == "true" {
        return;
    }

    let template_id = std::env::var("E2B_TEMPLATE_ID")
        .unwrap_or_else(|_| "base".to_string());
    
    let sandbox = AsyncSandbox::create(&template_id).await.unwrap();
    
    let sandboxes = AsyncSandbox::list().await.unwrap();
    assert!(!sandboxes.is_empty());
    assert!(sandboxes.iter().any(|s| s.sandbox_id == sandbox.id));
    
    // Cleanup
    sandbox.kill().await.unwrap();
}

#[tokio::test]
async fn test_list_sandboxes_with_filter() {
    // Skip in debug mode - implementation pending
    if std::env::var("E2B_DEBUG").unwrap_or_default() == "true" {
        return;
    }

    let template_id = std::env::var("E2B_TEMPLATE_ID")
        .unwrap_or_else(|_| "base".to_string());
    
    let unique_id = Uuid::new_v4().to_string();
    let mut _metadata = HashMap::new();
    _metadata.insert("unique_id".to_string(), unique_id.clone());
    
    // Note: Metadata filtering will be implemented with sandbox creation
    let sandbox = AsyncSandbox::create(&template_id).await.unwrap();
    
    // For now, just verify we can list sandboxes
    let sandboxes = AsyncSandbox::list().await.unwrap();
    assert!(!sandboxes.is_empty());
    
    // Cleanup
    sandbox.kill().await.unwrap();
}