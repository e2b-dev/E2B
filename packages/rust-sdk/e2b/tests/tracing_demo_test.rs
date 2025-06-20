
#[tokio::test]
async fn test_tracing_demo() -> Result<(), Box<dyn std::error::Error>> {
    // Set up comprehensive tracing
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::TRACE)
        .with_test_writer()
        .try_init();
    
    tracing::error!("This is an ERROR message");
    tracing::warn!("This is a WARN message");
    tracing::info!("This is an INFO message");
    tracing::debug!("This is a DEBUG message");
    tracing::trace!("This is a TRACE message");
    
    // Show how to use structured logging
    tracing::info!(
        sandbox_id = "test123",
        command = "echo hello",
        exit_code = 0,
        "Command executed successfully"
    );
    
    // Show how to use tracing in different contexts
    let span = tracing::info_span!("sandbox_operation", sandbox_id = "test123");
    let _guard = span.enter();
    
    tracing::info!("Inside sandbox operation span");
    tracing::debug!("Debug info within the span");
    
    Ok(())
}