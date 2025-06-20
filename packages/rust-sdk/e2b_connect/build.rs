use std::env;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?);

    let proto_files = [
        manifest_dir.join("protos/filesystem/filesystem.proto"),
        manifest_dir.join("protos/process/process.proto"),
    ];
    let proto_includes = [
        manifest_dir.join("protos"),
    ];

    tonic_build::configure()
        .build_server(false)
        .compile_protos(
            &proto_files.iter().map(|p| p.to_str().unwrap()).collect::<Vec<_>>(),
            &proto_includes.iter().map(|p| p.to_str().unwrap()).collect::<Vec<_>>(),
        )?;
    Ok(())
}