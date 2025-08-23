# E2B SDK - Complete API Reference

## Overview

E2B is an open-source infrastructure that allows you to run AI-generated code in secure isolated sandboxes in the cloud. This document provides a comprehensive API reference for all E2B components.

**Repository**: https://github.com/e2b-dev/E2B  
**Documentation**: https://e2b.dev/docs  
**Main Products**:
- Python SDK (`e2b`)
- JavaScript/TypeScript SDK (`e2b`) 
- CLI Tool (`@e2b/cli`)
- Code Interpreter SDK (separate repository)

## Quick Start

### Environment Setup
```bash
# Get API key from https://e2b.dev/dashboard?tab=keys
export E2B_API_KEY=e2b_***
```

### Python Installation
```bash
pip install e2b
```

### JavaScript Installation
```bash
npm install e2b
```

### CLI Installation
```bash
npm install -g @e2b/cli
# or
brew install e2b
```

---

# Python SDK API

## Installation and Setup

```bash
pip install e2b
```

## Main Imports

```python
from e2b import Sandbox, AsyncSandbox
from e2b import ApiClient, client
from e2b import (
    SandboxException, TimeoutException, NotFoundException,
    AuthenticationException, InvalidArgumentException,
    NotEnoughSpaceException, TemplateException
)
from e2b import (
    CommandResult, CommandHandle, AsyncCommandHandle,
    WatchHandle, AsyncWatchHandle,
    EntryInfo, FileType, FilesystemEvent, FilesystemEventType,
    ProcessInfo, PtySize, PtyOutput
)
```

## Core Classes

### Sandbox (Sync)

Main synchronous sandbox class for creating and managing cloud environments.

```python
class Sandbox:
    def __init__(
        self,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        connection_config: Optional[ConnectionConfig] = None
    )
    
    # Properties
    @property
    def sandbox_id(self) -> str
    @property
    def files(self) -> Filesystem
    @property
    def commands(self) -> Commands
    @property
    def pty(self) -> Pty
    
    # Core methods
    def is_running(self, request_timeout: Optional[float] = None) -> bool
    def kill(self, request_timeout: Optional[float] = None) -> bool
    def set_timeout(self, timeout: int, request_timeout: Optional[float] = None) -> None
    def get_info(self, request_timeout: Optional[float] = None) -> SandboxInfo
    
    # Class methods
    @classmethod
    def connect(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        connection_config: Optional[ConnectionConfig] = None
    ) -> "Sandbox"
    
    # Context manager support
    def __enter__(self) -> "Sandbox"
    def __exit__(self, exc_type, exc_value, traceback) -> None
```

### AsyncSandbox (Async)

Main asynchronous sandbox class for creating and managing cloud environments.

```python
class AsyncSandbox:
    def __init__(self, **opts: AsyncSandboxOpts)
    
    # Properties
    @property
    def sandbox_id(self) -> str
    @property
    def files(self) -> Filesystem
    @property
    def commands(self) -> Commands
    @property
    def pty(self) -> Pty
    
    # Core methods
    async def is_running(self, request_timeout: Optional[float] = None) -> bool
    async def kill(self, request_timeout: Optional[float] = None) -> bool
    async def set_timeout(self, timeout: int, request_timeout: Optional[float] = None) -> None
    async def get_info(self, request_timeout: Optional[float] = None) -> SandboxInfo
    
    # Class methods
    @classmethod
    async def create(
        cls,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        connection_config: Optional[ConnectionConfig] = None
    ) -> "AsyncSandbox"
    
    @classmethod
    async def connect(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        connection_config: Optional[ConnectionConfig] = None
    ) -> "AsyncSandbox"
    
    # Async context manager support
    async def __aenter__(self) -> "AsyncSandbox"
    async def __aexit__(self, exc_type, exc_value, traceback) -> None
```

## Filesystem Operations

### Filesystem (Sync)

```python
class Filesystem:
    # Reading files
    def read(
        self,
        path: str,
        format: Literal["text"] = "text",
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> str
    
    def read(
        self,
        path: str,
        format: Literal["bytes"],
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> bytearray
    
    def read(
        self,
        path: str,
        format: Literal["stream"],
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> Iterator[bytes]
    
    # Writing files
    def write(
        self,
        path: str,
        data: Union[str, bytes, IO],
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> None
    
    def write(
        self,
        files: List[WriteEntry],
        user: Optional[Username] = "user",
        request_timeout: Optional[float] = None
    ) -> None
    
    # Directory operations
    def list(
        self,
        path: str,
        depth: Optional[int] = 1,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> List[EntryInfo]
    
    def exists(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> bool
    
    def remove(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> None
    
    def rename(
        self,
        old_path: str,
        new_path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> None
    
    def make_dir(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> None
    
    # File watching
    def watch_dir(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> WatchHandle
```

### Filesystem (Async)

Same methods as sync version but with `async` prefix and returning `AsyncIterator` for streams and `AsyncWatchHandle` for watching.

## Command Execution

### Commands (Sync)

```python
class Commands:
    def list(self, request_timeout: Optional[float] = None) -> List[ProcessInfo]
    
    def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None
    ) -> None
    
    def send_stdin(
        self,
        pid: int,
        data: str,
        request_timeout: Optional[float] = None
    ) -> None
    
    # Run command and wait for completion
    def run(
        self,
        cmd: str,
        background: Union[Literal[False], None] = None,
        timeout: Optional[float] = None,
        cwd: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> CommandResult
    
    # Run command in background
    def run(
        self,
        cmd: str,
        background: Literal[True],
        timeout: Optional[float] = None,
        cwd: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Username = "user",
        request_timeout: Optional[float] = None
    ) -> CommandHandle
    
    def connect(
        self,
        pid: int,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None
    ) -> CommandHandle
```

### Commands (Async)

Same methods as sync version but with `async` prefix and returning `AsyncCommandHandle`.

## Data Types

### Core Types

```python
@dataclass
class EntryInfo:
    """Sandbox filesystem object information."""
    name: str
    type: Optional[FileType]
    size: Optional[int]

class FileType(Enum):
    FILE = "file"
    DIR = "dir"

@dataclass
class WriteEntry:
    """Contains path and data of the file to be written."""
    path: str
    data: Union[str, bytes, IO]

@dataclass
class CommandResult:
    """Command execution result."""
    stderr: str
    stdout: str
    exit_code: int

@dataclass
class PtySize:
    """Pseudo-terminal size."""
    rows: int
    cols: int

# Type aliases
Stdout = str
Stderr = str
PtyOutput = bytes
```

### Process Information

```python
@dataclass
class ProcessInfo:
    """Information about a running process."""
    pid: int
    cmd: str
    # Additional process details
```

## Exception Classes

```python
class SandboxException(Exception):
    """Base exception for sandbox operations."""

class TimeoutException(SandboxException):
    """Raised when operations timeout."""

class NotFoundException(SandboxException):
    """Raised when resources are not found."""

class AuthenticationException(SandboxException):
    """Raised for authentication errors."""

class InvalidArgumentException(SandboxException):
    """Raised for invalid arguments."""

class NotEnoughSpaceException(SandboxException):
    """Raised when there's insufficient space."""

class TemplateException(SandboxException):
    """Raised for template-related errors."""

class CommandExitException(SandboxException, CommandResult):
    """Raised when command exits with non-zero code."""
```

## API Client

### ApiClient

```python
class ApiClient(AuthenticatedClient):
    """Client for interacting with the E2B API."""
    
    def __init__(
        self,
        config: ConnectionConfig,
        require_api_key: bool = True,
        require_access_token: bool = False,
        limits: Optional[Limits] = None
    )
```

Available API endpoints include:
- `get_sandboxes()` - List sandboxes
- `post_sandboxes()` - Create sandbox
- `get_sandboxes_sandbox_id()` - Get sandbox info
- `delete_sandboxes_sandbox_id()` - Delete sandbox
- `post_sandboxes_sandbox_id_timeout()` - Set timeout
- `get_sandboxes_sandbox_id_logs()` - Get logs
- `get_sandboxes_sandbox_id_metrics()` - Get metrics

## Usage Examples

### Basic Sync Usage

```python
from e2b import Sandbox

# Create and use sandbox
with Sandbox() as sandbox:
    # Run command
    result = sandbox.commands.run("echo 'Hello World'")
    print(result.stdout)
    
    # Write file
    sandbox.files.write("/tmp/test.txt", "Hello from E2B!")
    
    # Read file
    content = sandbox.files.read("/tmp/test.txt")
    print(content)
```

### Basic Async Usage

```python
from e2b import AsyncSandbox

async def main():
    async with await AsyncSandbox.create() as sandbox:
        # Run command
        result = await sandbox.commands.run("echo 'Hello World'")
        print(result.stdout)
        
        # Write file
        await sandbox.files.write("/tmp/test.txt", "Hello from E2B!")
        
        # Read file
        content = await sandbox.files.read("/tmp/test.txt")
        print(content)
```

### Connection Configuration

```python
from e2b import ConnectionConfig, Sandbox

config = ConnectionConfig(
    api_key="your-api-key",
    domain="custom-domain.com",
    debug=True
)

sandbox = Sandbox(connection_config=config)
```

---

# JavaScript/TypeScript SDK API

## Installation and Setup

```bash
npm install e2b
```

### Environment Setup
```bash
export E2B_API_KEY=e2b_***
```

### Basic Import
```typescript
import { Sandbox } from 'e2b'
// or
import Sandbox from 'e2b'
```

## Main Classes

### Sandbox Class

The main class for creating and managing sandboxes.

#### Static Methods

```typescript
// Create a new sandbox with default template
static async create<S extends typeof Sandbox>(
  this: S,
  opts?: SandboxOpts
): Promise<InstanceType<S>>

// Create a new sandbox with specific template
static async create<S extends typeof Sandbox>(
  this: S,
  template: string,
  opts?: SandboxOpts
): Promise<InstanceType<S>>

// Connect to existing sandbox
static async connect<S extends typeof Sandbox>(
  this: S,
  sandboxId: string,
  opts?: Omit<SandboxOpts, 'metadata' | 'envs' | 'timeoutMs'>
): Promise<InstanceType<S>>
```

#### Instance Properties

```typescript
// Filesystem operations
readonly filesystem: Filesystem

// Command execution
readonly commands: Commands
```

#### SandboxOpts Interface

```typescript
interface SandboxOpts extends ConnectionOpts {
  metadata?: Record<string, string>        // Custom metadata
  envs?: Record<string, string>           // Environment variables
  timeoutMs?: number                      // Timeout in milliseconds (default: 300,000)
  secure?: boolean                        // Secure traffic with auth token (default: false)
}
```

## Filesystem Operations

### Filesystem Class

```typescript
class Filesystem {
  // Read file content
  async read(path: string, opts?: FilesystemRequestOpts & { format?: 'text' }): Promise<string>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'bytes' }): Promise<Uint8Array>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'blob' }): Promise<Blob>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'stream' }): Promise<ReadableStream<Uint8Array>>

  // Write file content
  async write(
    path: string,
    data: string | ArrayBuffer | Blob | ReadableStream,
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo>
  
  async write(
    files: WriteEntry[],
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo[]>

  // List directory contents
  async list(path: string, opts?: FilesystemListOpts): Promise<EntryInfo[]>

  // Create directory
  async makeDir(path: string, opts?: FilesystemRequestOpts): Promise<boolean>

  // Remove file or directory
  async remove(path: string, opts?: FilesystemRequestOpts): Promise<void>

  // Rename/move file or directory
  async rename(
    oldPath: string,
    newPath: string,
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo>

  // Check if file/directory exists
  async exists(path: string, opts?: FilesystemRequestOpts): Promise<boolean>

  // Watch directory for changes
  async watchDir(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: WatchOpts & {
      onExit?: (err?: Error) => void | Promise<void>
    }
  ): Promise<WatchHandle>
}
```

### Types and Interfaces

```typescript
// File type enumeration
enum FileType {
  FILE = 'file',
  DIRECTORY = 'directory'
}

// File/directory information
interface EntryInfo {
  name: string
  type?: FileType
  path: string
}

// Write entry for batch operations
interface WriteEntry {
  path: string
  data: string | ArrayBuffer | Blob | ReadableStream
}

// Filesystem events
interface FilesystemEvent {
  type: FilesystemEventType
  path: string
}

enum FilesystemEventType {
  CREATE = 'create',
  WRITE = 'write',
  REMOVE = 'remove',
  RENAME = 'rename'
}
```

## Command Execution

### Commands Class

```typescript
class Commands {
  // Run command and wait for completion
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: false }
  ): Promise<CommandResult>

  // Run command in background
  async run(
    cmd: string,
    opts: CommandStartOpts & { background: true }
  ): Promise<CommandHandle>
}
```

### Command Options and Results

```typescript
// Command start options
interface CommandStartOpts extends CommandRequestOpts {
  background?: boolean    // Run in background
  cwd?: string           // Working directory
  user?: Username        // User to run as
  envs?: Record<string, string>  // Environment variables
}

// Command execution result
interface CommandResult {
  exitCode: number       // Exit code (0 for success)
  error?: string        // Error message if failed
  stdout: string        // Standard output
  stderr: string        // Standard error
}

// Command handle for background processes
interface CommandHandle {
  // Wait for command completion
  wait(): Promise<CommandResult>
  
  // Kill the process
  kill(): Promise<void>
  
  // Send input to process
  sendStdin(data: string): Promise<void>
  
  // Process ID
  readonly pid: number
}
```

## API Client

### ApiClient Class

```typescript
class ApiClient {
  readonly api: ReturnType<typeof createClient<paths>>
  
  constructor(
    config: ConnectionConfig,
    opts?: {
      requireAccessToken?: boolean
      requireApiKey?: boolean
    }
  )
}
```

## Connection Configuration

```typescript
interface ConnectionOpts {
  apiKey?: string           // E2B API key
  accessToken?: string      // Access token
  apiUrl?: string          // API URL (default: https://api.e2b.dev)
  requestTimeoutMs?: number // Request timeout
  logger?: Logger          // Custom logger
}
```

## Error Handling

```typescript
// Available error types
class AuthenticationError extends Error {}
class InvalidArgumentError extends Error {}
class NotEnoughSpaceError extends Error {}
class NotFoundError extends Error {}
class SandboxError extends Error {}
class TemplateError extends Error {}
class TimeoutError extends Error {}
class CommandExitError extends Error {}
```

## Usage Examples

### Basic Sandbox Creation
```typescript
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create()
```

### File Operations
```typescript
// Write file
await sandbox.filesystem.write('/tmp/hello.txt', 'Hello, World!')

// Read file
const content = await sandbox.filesystem.read('/tmp/hello.txt')

// List directory
const entries = await sandbox.filesystem.list('/tmp')

// Create directory
await sandbox.filesystem.makeDir('/tmp/new-dir')
```

### Command Execution
```typescript
// Run command and wait
const result = await sandbox.commands.run('ls -la')
console.log(result.stdout)

// Run in background
const handle = await sandbox.commands.run('long-running-process', { background: true })
const result = await handle.wait()
```

### Watch Directory Changes
```typescript
const watchHandle = await sandbox.filesystem.watchDir(
  '/tmp',
  (event) => {
    console.log(`File ${event.type}: ${event.path}`)
  }
)

// Stop watching
await watchHandle.close()
```

---

# CLI Tool API

## Installation

### Using Homebrew (macOS)
```bash
brew install e2b
```

### Using NPM
```bash
npm install -g @e2b/cli
```

## Overview

The E2B CLI tool allows you to build and manage E2B sandbox templates and running sandboxes. The CLI provides three main command groups:

- **auth** - Authentication commands
- **template** (alias: `tpl`) - Manage sandbox templates  
- **sandbox** (alias: `sbx`) - Work with running sandboxes

## Global Options

- `-p, --path <path>` - Change root directory where command is executed
- `--config <e2b-toml>` - Specify path to E2B config TOML file (default: `./e2b.toml`)
- `-t, --team <team-id>` - Specify team ID for operations

## Authentication Commands

### `e2b auth login`
Log in to the E2B CLI.

**Usage:**
```bash
e2b auth login
```

**Description:** Opens browser for authentication and stores credentials locally.

### `e2b auth logout`  
Log out of the E2B CLI.

**Usage:**
```bash
e2b auth logout
```

**Description:** Removes stored authentication credentials.

### `e2b auth info`
Get information about the current user.

**Usage:**
```bash
e2b auth info
```

**Description:** Displays current user configuration and authentication status.

### `e2b auth configure`
Configure user settings.

**Usage:**
```bash
e2b auth configure
```

**Description:** Interactive configuration of user settings including team selection.

## Template Commands

### `e2b template build [template]` (alias: `e2b tpl build`)
Build a sandbox template from Dockerfile.

**Usage:**
```bash
e2b template build [template]
```

**Arguments:**
- `[template]` - Optional template ID to rebuild. If not specified, creates new template or uses `e2b.toml` config.

**Options:**
- `-d, --dockerfile <file>` - Specify path to Dockerfile (default: `e2b.Dockerfile` or `Dockerfile`)
- `-n, --name <template-name>` - Specify sandbox template name (lowercase, letters, numbers, dashes, underscores only)
- `-c, --cmd <start-command>` - Specify command executed when sandbox starts
- `--ready-cmd <ready-command>` - Specify command that must exit 0 for template to be ready
- `-p, --path <path>` - Change root directory
- `--config <e2b-toml>` - Specify config file path
- `-t, --team <team-id>` - Specify team ID

**Examples:**
```bash
# Build new template from current directory
e2b template build

# Rebuild existing template
e2b template build my-template-id

# Build with custom name and start command
e2b template build -n my-python-env -c "python app.py"

# Build with custom Dockerfile
e2b template build -d custom.Dockerfile
```

### `e2b template list` (alias: `e2b tpl ls`)
List all sandbox templates.

**Usage:**
```bash
e2b template list
```

**Options:**
- `-t, --team <team-id>` - List templates for specific team

**Description:** Displays table of all available sandbox templates with their IDs, names, and metadata.

### `e2b template init` (alias: `e2b tpl it`)
Create basic E2B Dockerfile in root directory.

**Usage:**
```bash
e2b template init
```

**Options:**
- `-p, --path <path>` - Change root directory

**Description:** Creates `e2b.Dockerfile` with basic template. Run `e2b template build` after initialization.

### `e2b template delete [template]`
Delete sandbox template and config.

**Usage:**
```bash
e2b template delete [template]
```

**Arguments:**
- `[template]` - Optional template ID to delete. If not specified, uses `e2b.toml` config.

**Options:**
- `-p, --path <path>` - Change root directory
- `--config <e2b-toml>` - Specify config file path
- `-s, --select` - Select multiple templates from interactive list
- `-t, --team <team-id>` - Specify team ID

**Examples:**
```bash
# Delete template from current directory config
e2b template delete

# Delete specific template
e2b template delete template-id-123

# Interactive selection
e2b template delete --select
```

### `e2b template publish [template]`
Publish sandbox template to make it publicly available.

**Usage:**
```bash
e2b template publish [template]
```

**Arguments:**
- `[template]` - Optional template ID to publish

**Options:**
- `-p, --path <path>` - Change root directory
- `--config <e2b-toml>` - Specify config file path
- `-s, --select` - Select template from interactive list
- `-t, --team <team-id>` - Specify team ID

### `e2b template unpublish [template]`
Unpublish sandbox template to make it private.

**Usage:**
```bash
e2b template unpublish [template]
```

**Arguments:**
- `[template]` - Optional template ID to unpublish

**Options:** Same as publish command.

## Sandbox Commands

### `e2b sandbox spawn [template]` (alias: `e2b sbx sp`)
Spawn sandbox and connect terminal to it.

**Usage:**
```bash
e2b sandbox spawn [template]
```

**Arguments:**
- `[template]` - Optional template ID to spawn sandbox from

**Options:**
- `-p, --path <path>` - Change root directory
- `--config <e2b-toml>` - Specify config file path

**Description:** Creates new sandbox instance and opens interactive terminal connection.

**Examples:**
```bash
# Spawn from current directory template config
e2b sandbox spawn

# Spawn from specific template
e2b sandbox spawn my-template-id
```

### `e2b sandbox connect <sandboxID>` (alias: `e2b sbx cn`)
Connect terminal to already running sandbox.

**Usage:**
```bash
e2b sandbox connect <sandboxID>
```

**Arguments:**
- `<sandboxID>` - Required sandbox ID to connect to

**Description:** Opens interactive terminal connection to existing sandbox.

**Examples:**
```bash
e2b sandbox connect sandbox-abc123
```

### `e2b sandbox list` (alias: `e2b sbx ls`)
List all running sandboxes.

**Usage:**
```bash
e2b sandbox list
```

**Description:** Displays table of all running sandboxes with IDs, template info, and runtime details.

### `e2b sandbox kill [sandboxID]` (alias: `e2b sbx kl`)
Kill running sandbox(es).

**Usage:**
```bash
e2b sandbox kill [sandboxID]
```

**Arguments:**
- `[sandboxID]` - Optional sandbox ID to kill

**Options:**
- `-a, --all` - Kill all running sandboxes

**Examples:**
```bash
# Kill specific sandbox
e2b sandbox kill sandbox-abc123

# Kill all running sandboxes
e2b sandbox kill --all
```

### `e2b sandbox logs <sandboxID>`
View logs from running sandbox.

**Usage:**
```bash
e2b sandbox logs <sandboxID>
```

**Arguments:**
- `<sandboxID>` - Required sandbox ID to view logs from

**Description:** Streams logs from the specified sandbox with timestamps and formatting.

## Configuration

The CLI uses `e2b.toml` configuration files to store template settings:

```toml
template_id = "your-template-id"
template_name = "your-template-name"
```

Configuration files are automatically created during `e2b template build` operations.

## Common Workflows

### Creating a New Template
```bash
# 1. Initialize Dockerfile
e2b template init

# 2. Edit e2b.Dockerfile as needed
# 3. Build template
e2b template build -n my-custom-env

# 4. Test by spawning sandbox
e2b sandbox spawn
```

### Managing Running Sandboxes
```bash
# List running sandboxes
e2b sandbox list

# Connect to sandbox
e2b sandbox connect sandbox-id

# View logs
e2b sandbox logs sandbox-id

# Kill sandbox when done
e2b sandbox kill sandbox-id
```

### Template Management
```bash
# List all templates
e2b template list

# Delete old templates
e2b template delete --select

# Publish template for sharing
e2b template publish my-template-id
```

---

# Core API Models and Types

## Core Data Models

### Sandbox Models
- **Sandbox**: Core sandbox representation with `client_id`, `envd_version`, `sandbox_id`, `template_id`, optional `alias` and `envd_access_token`
- **NewSandbox**: Sandbox creation request with `template_id` (required), optional `auto_pause`, `env_vars`, `metadata`, `secure`, and `timeout` (default: 15 seconds)
- **ListedSandbox**: Extended sandbox info including `started_at`, `cpu_count`, `memory_mb`, `end_at`, and `state`
- **ResumedSandbox**: Sandbox resume request with `timeout` and `auto_pause` options
- **SandboxDetail**: Detailed sandbox information
- **RunningSandboxWithMetrics**: Sandbox with performance metrics
- **SandboxState**: Enum with values `"paused"` and `"running"`

### Template Models
- **Template**: Template definition with `build_count`, `build_id`, `cpu_count`, `created_at`, `created_by`, `last_spawned_at`, `memory_mb`, `public`, `spawn_count`, and `template_id`
- **TemplateBuild**: Build information for templates
- **TemplateBuildRequest**: Request to build a template
- **TemplateBuildStatus**: Build status tracking
- **TemplateUpdateRequest**: Template update operations

### Team and Authentication Models
- **Team**: Team information with `api_key`, `is_default`, `name`, and `team_id`
- **TeamUser**: User within a team
- **TeamAPIKey**: API key for team access
- **CreatedTeamAPIKey**: Response when creating team API keys
- **NewTeamAPIKey**: Request to create team API keys
- **UpdateTeamAPIKey**: Request to update team API keys
- **CreatedAccessToken**: Access token creation response
- **NewAccessToken**: Access token creation request

### Monitoring and Logging Models
- **SandboxLog**: Log entry with `line` content and `timestamp`
- **SandboxLogs**: Collection of sandbox logs
- **SandboxMetric**: Performance metrics with `cpu_count`, `cpu_used_pct`, `mem_total_mib`, `mem_used_mib`, and `timestamp`
- **Node**: Infrastructure node with `allocated_cpu`, `allocated_memory_mib`, `create_fails`, `node_id`, `sandbox_count`, and `status`
- **NodeDetail**: Detailed node information
- **NodeStatus**: Node status enumeration
- **NodeStatusChange**: Node status change events

### Error Models
- **Error**: Standard error response with `code` (int32) and `message` (string)

## API Endpoints

### Sandbox Operations
- `GET /sandboxes` - List all running sandboxes (with optional metadata filtering)
- `POST /sandboxes` - Create sandbox from template
- `GET /v2/sandboxes` - List all sandboxes (with state filtering)
- `GET /sandboxes/{sandboxID}` - Get sandbox by ID
- `DELETE /sandboxes/{sandboxID}` - Kill sandbox
- `POST /sandboxes/{sandboxID}/pause` - Pause sandbox
- `POST /sandboxes/{sandboxID}/resume` - Resume sandbox
- `POST /sandboxes/{sandboxID}/timeout` - Set sandbox timeout
- `POST /sandboxes/{sandboxID}/refreshes` - Refresh sandbox TTL

### Monitoring Endpoints
- `GET /sandboxes/metrics` - List running sandboxes with metrics
- `GET /sandboxes/{sandboxID}/logs` - Get sandbox logs (with start/end parameters)
- `GET /sandboxes/{sandboxID}/metrics` - Get sandbox metrics

### Template Management
- `GET /templates` - List templates
- `POST /templates` - Create new template
- `POST /templates/{templateID}/builds` - Build template
- `DELETE /templates/{templateID}` - Delete template
- `PATCH /templates/{templateID}` - Update template
- `GET /templates/{templateID}/builds/{buildID}` - Get template build

### Team Management
- `GET /teams` - List all teams
- `GET /health` - Health check endpoint

## Configuration Options

### Python SDK (ConnectionConfig)
```python
class ConnectionConfig:
    domain: str = "e2b.app"  # E2B_DOMAIN env var
    debug: bool = False      # E2B_DEBUG env var
    api_key: str            # E2B_API_KEY env var
    access_token: str       # E2B_ACCESS_TOKEN env var
    request_timeout: float = 30.0  # seconds
    headers: Dict[str, str]
    proxy: Optional[ProxyTypes]
    api_url: str  # Derived from domain/debug
```

### JavaScript SDK (ConnectionConfig)
```typescript
interface ConnectionOpts {
    apiKey?: string           // E2B_API_KEY env var
    accessToken?: string      // E2B_ACCESS_TOKEN env var
    domain?: string          // E2B_DOMAIN env var or 'e2b.app'
    debug?: boolean          // E2B_DEBUG env var
    requestTimeoutMs?: number // Default: 30,000ms
    logger?: Logger
    headers?: Record<string, string>
}
```

### Common Configuration
- **REQUEST_TIMEOUT**: 30 seconds (Python) / 30,000ms (JavaScript)
- **KEEPALIVE_PING_INTERVAL**: 50 seconds
- **Default Username**: `"user"` (can be `"root"` or `"user"`)
- **Default Sandbox Timeout**: 15 seconds
- **API URL**: `https://api.{domain}` (production) or `http://localhost:3000` (debug)

## Error Handling

### Python SDK Exceptions
- **SandboxException**: Base class for all sandbox errors
- **TimeoutException**: Timeout-related errors (unavailable, canceled, deadline_exceeded)
- **InvalidArgumentException**: Invalid argument provided
- **NotEnoughSpaceException**: Insufficient disk space
- **NotFoundException**: Resource not found
- **AuthenticationException**: Authentication failures
- **TemplateException**: Template compatibility issues
- **RateLimitException**: API rate limit exceeded

### HTTP Error Responses
- **400**: Bad request - Invalid parameters or request format
- **401**: Authentication error - Invalid or missing credentials
- **404**: Not found - Resource doesn't exist
- **409**: Conflict - Resource state conflict (e.g., sandbox already running)
- **500**: Server error - Internal server issues

### Authentication Methods
- **ApiKeyAuth**: API key in `X-API-Key` header
- **AccessTokenAuth**: Bearer token authentication
- **Supabase1TokenAuth**: Supabase token in `X-Supabase-Token` header
- **Supabase2TeamAuth**: Supabase team in `X-Supabase-Team` header
- **AdminTokenAuth**: Admin token in `X-Admin-Token` header

All error responses follow the standard `Error` schema with `code` (integer) and `message` (string) fields.

---

# Advanced Usage Patterns

## Environment Variables

### Required
- `E2B_API_KEY` - Your E2B API key (get from https://e2b.dev/dashboard?tab=keys)

### Optional
- `E2B_DOMAIN` - Custom domain (default: `e2b.app`)
- `E2B_DEBUG` - Enable debug mode (default: `false`)
- `E2B_ACCESS_TOKEN` - Access token for authentication

## Template Configuration

### e2b.toml Configuration File
```toml
template_id = "your-template-id"
template_name = "your-template-name"

[build]
cmd = "python app.py"  # Start command
ready_cmd = "curl -f http://localhost:8000/health"  # Health check
```

### e2b.Dockerfile Example
```dockerfile
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy application
COPY . /app
WORKDIR /app

# Set default command
CMD ["python3", "app.py"]
```

## Best Practices

### Resource Management
- Always use context managers (`with` in Python, proper cleanup in JS)
- Set appropriate timeouts for long-running operations
- Kill sandboxes when done to avoid resource waste
- Use background processes for long-running commands

### Error Handling
- Catch specific exceptions rather than generic ones
- Implement retry logic for transient failures
- Log errors with context for debugging
- Handle timeout exceptions gracefully

### Security
- Never hardcode API keys in source code
- Use environment variables for configuration
- Enable secure mode for production workloads
- Validate user input before passing to sandbox

### Performance
- Reuse sandbox instances when possible
- Use async operations for concurrent tasks
- Stream large files instead of loading into memory
- Monitor sandbox metrics for optimization

## Common Integration Patterns

### AI Agent Integration
```python
from e2b import Sandbox

class CodeExecutor:
    def __init__(self):
        self.sandbox = None
    
    async def execute_code(self, code: str, language: str = "python"):
        if not self.sandbox:
            self.sandbox = await Sandbox.create()
        
        if language == "python":
            result = await self.sandbox.commands.run(f"python3 -c '{code}'")
        elif language == "bash":
            result = await self.sandbox.commands.run(code)
        
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.exit_code
        }
    
    async def cleanup(self):
        if self.sandbox:
            await self.sandbox.kill()
```

### File Processing Pipeline
```python
from e2b import Sandbox
import asyncio

async def process_files(file_paths: list[str]):
    async with await Sandbox.create() as sandbox:
        # Upload files
        for path in file_paths:
            with open(path, 'rb') as f:
                await sandbox.files.write(f"/tmp/{path}", f.read())
        
        # Process files
        result = await sandbox.commands.run("python3 /tmp/process.py")
        
        # Download results
        output = await sandbox.files.read("/tmp/output.json")
        return output
```

### Multi-Language Support
```typescript
import { Sandbox } from 'e2b'

class MultiLanguageRunner {
  private sandbox: Sandbox | null = null
  
  async init() {
    this.sandbox = await Sandbox.create()
  }
  
  async runPython(code: string) {
    return await this.sandbox!.commands.run(`python3 -c "${code}"`)
  }
  
  async runNode(code: string) {
    await this.sandbox!.filesystem.write('/tmp/script.js', code)
    return await this.sandbox!.commands.run('node /tmp/script.js')
  }
  
  async runBash(script: string) {
    return await this.sandbox!.commands.run(script)
  }
  
  async cleanup() {
    if (this.sandbox) {
      await this.sandbox.kill()
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify E2B_API_KEY is set correctly
   - Check API key permissions and team access
   - Ensure API key hasn't expired

2. **Timeout Issues**
   - Increase request timeout for long operations
   - Use background processes for long-running commands
   - Check network connectivity

3. **File System Errors**
   - Verify file paths are absolute
   - Check file permissions and ownership
   - Ensure sufficient disk space

4. **Template Build Failures**
   - Check Dockerfile syntax
   - Verify base image availability
   - Review build logs for specific errors

### Debug Mode

Enable debug mode for detailed logging:

```bash
export E2B_DEBUG=true
```

Or programmatically:

```python
from e2b import Sandbox, ConnectionConfig

config = ConnectionConfig(debug=True)
sandbox = Sandbox(connection_config=config)
```

```typescript
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ debug: true })
```

## Migration Guide

### From v0.x to v1.x

**Python Changes:**
- `Sandbox()` constructor now requires explicit `create()` call for async
- File operations moved to `sandbox.files` namespace
- Command operations moved to `sandbox.commands` namespace
- Error classes renamed and reorganized

**JavaScript Changes:**
- Import changed from `@e2b/sdk` to `e2b`
- Async/await required for all operations
- File operations moved to `sandbox.filesystem` namespace
- Command operations moved to `sandbox.commands` namespace

### Breaking Changes
- Removed synchronous file operations in JS SDK
- Changed error handling patterns
- Updated configuration options
- Modified template building process

---

# Summary

This document provides comprehensive API documentation for the E2B SDK ecosystem, including:

- **Python SDK** (`e2b`) - Synchronous and asynchronous sandbox management
- **JavaScript SDK** (`e2b`) - Modern async/await based sandbox operations  
- **CLI Tool** (`@e2b/cli`) - Command-line interface for template and sandbox management
- **Core API** - REST API endpoints and data models
- **Advanced Patterns** - Best practices and integration examples

For the latest updates and examples, visit:
- Documentation: https://e2b.dev/docs
- GitHub: https://github.com/e2b-dev/E2B
- Examples: https://github.com/e2b-dev/e2b-cookbook

