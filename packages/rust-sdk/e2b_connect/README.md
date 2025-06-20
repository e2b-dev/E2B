# E2B Connect

This package contains the generated Rust gRPC client code for E2B's filesystem and process services.

## Code Generation

The Rust protobuf and gRPC client code is generated using [buf](https://buf.build/) from the protobuf definitions in `../../spec/envd/`.

### Prerequisites

- Install [buf](https://buf.build/docs/installation)
- Ensure the protobuf definitions are available in `../../spec/envd/`

### Generating Client Code

From the `../../spec/envd/` directory, run:

```bash
buf generate --template buf-rust.gen.yaml
```

This uses the configuration in `buf-rust.gen.yaml` to generate:
- Rust protobuf structs and message types using prost
- gRPC service clients with async support using tonic
- All generated code is placed in `src/` directory

### Configuration

The generation is configured in `../../spec/envd/buf-rust.gen.yaml`:

```yaml
version: v1
plugins:
  - plugin: buf.build/community/neoeinstein-prost
    out: ../../packages/rust-sdk/e2b_connect/src
    opt:
      - compile_well_known_types
  - plugin: buf.build/community/neoeinstein-tonic
    out: ../../packages/rust-sdk/e2b_connect/src
    opt:
      - compile_well_known_types
```

### Usage

The generated clients are available as:

```rust
use e2b_connect::filesystem;
use e2b_connect::process::ProcessServiceClient;

// Use the generated types and clients
```

## Build Process

This package uses a `build.rs` script to automatically regenerate the protobuf code during builds if needed.