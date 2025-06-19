# connect-python

A Go-based protobuf plugin for generating Python client implementations for the [Connect](https://connect.build) RPC protocol, specifically designed for E2B's envd communication.

🚧 Currently pending [an open RFC to be moved into the Connect RPC org](https://github.com/connectrpc/connectrpc.com/pull/71). Please show support. 🚧

## Overview

`connect-python` is a protoc plugin written in Go that generates Python client code for Connect RPC services. It's used within the E2B ecosystem to generate Python clients for communicating with envd (E2B's environment daemon) services.

## Features

- **Go-based protoc plugin**: Generates Python Connect RPC clients from protobuf definitions
- **E2B Integration**: Specifically designed for E2B's envd protocol communication
- **Async Support**: Generated clients support both synchronous and asynchronous operations
- **Connection Pooling**: Built-in support for HTTP connection pooling

## Installation

This plugin is primarily used as part of the E2B build process. To build the plugin:

```bash
# Build the protoc plugin
make build

# This creates bin/protoc-gen-connect-python
```

## Usage

### As part of E2B build process

The plugin is automatically used when running the E2B codegen:

```bash
# From the root of the E2B repository
make codegen
```

### Manual usage

```bash
# Generate Python clients from protobuf files
protoc --plugin=protoc-gen-connect-python=./bin/protoc-gen-connect-python \
       --connect-python_out=./output \
       your_service.proto
```

## Generated Code Structure

The plugin generates Python client code with the following structure:

```python
# Generated *_connect.py files contain:
class YourServiceClient:
    def __init__(self, base_url: str, *, pool: Optional[ConnectionPool] = None, ...):
        # Client initialization
    
    def your_method(self, request):
        # Synchronous method calls
    
    async def your_method_async(self, request):
        # Asynchronous method calls
```

## Development

### Prerequisites

- Go 1.22+
- Protocol Buffers compiler (`protoc`)

### Building

```bash
# Install dependencies
go mod download

# Build the plugin
make build

# Run tests (if available)
go test ./...
```

### Code Generation

The plugin reads protobuf service definitions and generates Python client code that:

1. Imports necessary Connect and HTTP libraries
2. Creates client classes for each service
3. Implements methods for each RPC call
4. Supports both sync and async operations
5. Handles connection pooling and configuration

## Integration with E2B

This plugin is specifically used to generate Python clients for E2B's envd protocol, enabling:

- **File System Operations**: Remote file system access within sandboxes
- **Process Management**: Starting and managing processes in sandboxes  
- **Stream Communication**: Real-time communication with running processes

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## Contributing

This package is part of the E2B ecosystem. For contributions:

1. Follow the main E2B contribution guidelines
2. Ensure Go code follows standard formatting (`go fmt`)
3. Test generated Python code works correctly
4. Update documentation as needed
