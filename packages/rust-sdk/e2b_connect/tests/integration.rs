use e2b_connect::{filesystem, process};

#[test]
fn test_proto_types_are_generated() {
    // Test that filesystem types are available
    let _list_request = filesystem::ListDirRequest {
        path: "/test".to_string(),
        depth: 1,
    };
    
    let _stat_request = filesystem::StatRequest {
        path: "/test".to_string(),
    };
    
    // Test that process types are available
    let _start_request = process::StartRequest {
        process: None,
        pty: None,
        tag: None,
    };
    
    // Test that clients can be referenced
    type _FilesystemClientType = filesystem::filesystem_client::FilesystemClient<tonic::transport::Channel>;
    type _ProcessClientType = process::process_client::ProcessClient<tonic::transport::Channel>;
}

#[test] 
fn test_enums_are_generated() {
    // Test filesystem enums
    let _file_type = filesystem::FileType::File;
    let _dir_type = filesystem::FileType::Directory;
    
    // Test event types
    let _create_event = filesystem::EventType::Create;
    let _write_event = filesystem::EventType::Write;
}