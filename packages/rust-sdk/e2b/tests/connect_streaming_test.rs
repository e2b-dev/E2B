use std::env;
use std::time::Duration;
use tokio::time::sleep;
use e2b::{AsyncSandbox, AsyncCommands, AsyncFilesystem};
use e2b::filesystem::FileType;

#[tokio::test]
async fn test_connect_streaming_with_long_lived_process() -> Result<(), Box<dyn std::error::Error>> {
    // Set up logging for debugging
    let _ = tracing_subscriber::fmt::try_init();
    
    // Set the API key
    env::set_var("E2B_API_KEY", "e2b_8243fedef2860914c837777fb42cf5f13e3d23c8");
    
    println!("Creating E2B sandbox...");
    
    // Create a new sandbox instance  
    let sandbox = AsyncSandbox::create("base").await?;
    println!("✅ Sandbox created: {}", sandbox.id);
    
    // Start a long-lived process using the start method (async streaming)
    println!("Starting long-lived process (sleep 30)...");
    let mut handle = sandbox.commands.start("sleep", &["30"]).await?;
    println!("✅ Long-lived process started with PID: {}", handle.pid);
    
    // Give the process a moment to start
    sleep(Duration::from_secs(2)).await;
    
    // Use pgrep to confirm the process is running
    println!("Checking if process is running with pgrep...");
    let pgrep_result = sandbox.commands.run("pgrep", &["-f", "sleep 30"]).await?;
    println!("pgrep output: '{}'", pgrep_result.stdout.trim());
    
    // Verify that pgrep found our process
    assert!(!pgrep_result.stdout.trim().is_empty(), "pgrep should find the sleep process");
    assert_eq!(pgrep_result.exit_code, 0, "pgrep should succeed");
    
    let found_pid: i32 = pgrep_result.stdout.trim().parse()
        .expect("pgrep output should be a valid PID");
    println!("✅ Found process with PID: {}", found_pid);
    
    // List all processes to get more details
    println!("Listing all processes...");
    let processes = sandbox.commands.list().await?;
    println!("Found {} processes:", processes.len());
    for proc in &processes {
        println!("  PID: {}, CMD: {}, ARGS: {:?}", proc.pid, proc.cmd, proc.args);
    }
    
    // Find our sleep process in the list
    let sleep_process = processes.iter()
        .find(|p| p.cmd == "sleep" && p.args.contains(&"30".to_string()));
    
    if let Some(proc) = sleep_process {
        println!("✅ Found sleep process in process list: PID {}", proc.pid);
        assert_eq!(proc.pid, found_pid, "Process list PID should match pgrep PID");
    } else {
        panic!("Sleep process not found in process list");
    }
    
    // Test streaming output by running a command that produces output over time
    println!("Testing streaming output with a command that produces periodic output...");
    let streaming_result = sandbox.commands.run("sh", &["-c", "for i in 1 2 3; do echo \"Output $i\"; sleep 1; done"]).await?;
    println!("Streaming command output: '{}'", streaming_result.stdout);
    assert!(streaming_result.stdout.contains("Output 1"));
    assert!(streaming_result.stdout.contains("Output 2"));
    assert!(streaming_result.stdout.contains("Output 3"));
    println!("✅ Streaming output test passed");
    
    // Kill the long-lived process
    println!("Killing the long-lived process...");
    sandbox.commands.kill(found_pid).await?;
    println!("✅ Process killed");
    
    // Wait a moment for the kill to take effect
    sleep(Duration::from_secs(2)).await;
    
    // Verify the process is no longer running
    let pgrep_after_kill = sandbox.commands.run("pgrep", &["-f", "sleep 30"]).await?;
    println!("pgrep after kill output: '{}'", pgrep_after_kill.stdout.trim());
    assert!(pgrep_after_kill.stdout.trim().is_empty() || pgrep_after_kill.exit_code != 0, 
            "Process should no longer be found by pgrep after kill");
    println!("✅ Process successfully killed and no longer running");
    
    // Clean up the sandbox
    println!("Cleaning up sandbox...");
    sandbox.close().await?;
    println!("✅ Sandbox closed");
    
    println!("🎉 All tests passed! Connect RPC streaming is working correctly.");
    
    Ok(())
}

#[tokio::test]
async fn test_connect_filesystem_streaming() -> Result<(), Box<dyn std::error::Error>> {
    // Set up logging
    let _ = tracing_subscriber::fmt::try_init();
    
    // Set the API key
    env::set_var("E2B_API_KEY", "e2b_8243fedef2860914c837777fb42cf5f13e3d23c8");
    
    println!("Creating E2B sandbox for filesystem streaming test...");
    
    // Create a new sandbox instance  
    let sandbox = AsyncSandbox::create("base").await?;
    println!("✅ Sandbox created: {}", sandbox.id);
    
    // Test basic filesystem operations
    println!("Testing filesystem operations...");
    
    // Create a test directory
    sandbox.filesystem.make_dir("/tmp/test_dir").await?;
    println!("✅ Created test directory");
    
    // Write a test file
    let test_content = b"Hello from Connect RPC!";
    sandbox.filesystem.write("/tmp/test_dir/test.txt", test_content).await?;
    println!("✅ Wrote test file");
    
    // Read the file back
    let read_content = sandbox.filesystem.read("/tmp/test_dir/test.txt").await?;
    assert_eq!(read_content, test_content);
    println!("✅ Read test file successfully");
    
    // List directory contents
    let entries = sandbox.filesystem.list("/tmp/test_dir").await?;
    println!("Directory contents:");
    for entry in &entries {
        println!("  {} ({})", entry.name, match entry.r#type {
            Some(FileType::File) => "file",
            Some(FileType::Dir) => "directory", 
            None => "unknown",
        });
    }
    
    let test_file = entries.iter().find(|e| e.name == "test.txt");
    assert!(test_file.is_some(), "test.txt should be in directory listing");
    println!("✅ File found in directory listing");
    
    // Clean up
    sandbox.filesystem.remove("/tmp/test_dir").await?;
    println!("✅ Cleaned up test directory");
    
    // Close sandbox
    sandbox.close().await?;
    println!("✅ Filesystem test completed successfully");
    
    Ok(())
}