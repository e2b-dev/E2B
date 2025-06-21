use e2b_connect::connect::{ConnectConfig, ConnectFilesystemClient};

#[test]
fn test_connect_client_creation() {
    let config = ConnectConfig {
        base_url: "https://49983-sb123.e2b.app".to_string(),
        use_json: true,
        ..Default::default()
    };
    
    let client = ConnectFilesystemClient::new(config);
    assert!(client.is_ok());
}

#[test]
fn test_connect_endpoint_format() {
    use e2b_connect::connect::ConnectClient;
    
    // Test debug mode endpoint
    let debug_endpoint = "http://localhost:49983";
    let config = ConnectConfig {
        base_url: debug_endpoint.to_string(),
        ..Default::default()
    };
    let client = ConnectClient::new(config);
    assert!(client.is_ok());
    
    // Test production endpoint
    let prod_endpoint = "https://49983-sb_1234567890abcdef.e2b.app";
    let config = ConnectConfig {
        base_url: prod_endpoint.to_string(),
        ..Default::default()
    };
    let client = ConnectClient::new(config);
    assert!(client.is_ok());
}

#[test]
fn test_json_type_conversions() {
    use e2b_connect::json_types;
    
    // Test filesystem request conversion
    let protobuf_req = e2b_connect::filesystem::ListDirRequest {
        path: "/test".to_string(),
        depth: 1,
    };
    
    let json_req: json_types::ListDirRequest = protobuf_req.into();
    assert_eq!(json_req.path, "/test");
    assert_eq!(json_req.depth, 1);
    
    // Test filesystem response conversion
    let json_resp = json_types::ListDirResponse {
        entries: vec![
            json_types::EntryInfo {
                name: "file.txt".to_string(),
                r#type: 1, // File
                path: "/test/file.txt".to_string(),
            }
        ],
    };
    
    let protobuf_resp: e2b_connect::filesystem::ListDirResponse = json_resp.into();
    assert_eq!(protobuf_resp.entries.len(), 1);
    assert_eq!(protobuf_resp.entries[0].name, "file.txt");
}