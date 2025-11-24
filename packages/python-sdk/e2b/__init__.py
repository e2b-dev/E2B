"""
Secure sandboxed cloud environments made for AI agents and AI apps.

Check docs [here](https://e2b.dev/docs).

E2B Sandbox is a secure cloud sandbox environment made for AI agents and AI
apps.
Sandboxes allow AI agents and apps to have long running cloud secure environments.
In these environments, large language models can use the same tools as humans do.

E2B Python SDK supports both sync and async API:

```py
from e2b import Sandbox

# Create sandbox
sandbox = Sandbox.create()
```

```py
from e2b import AsyncSandbox

# Create sandbox
sandbox = await AsyncSandbox.create()
```
"""

from .api import (
    ApiClient,
    client,
)
from .connection_config import (
    ConnectionConfig,
    ProxyTypes,
)
from .exceptions import (
    AuthenticationException,
    BuildException,
    FileUploadException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    NotFoundException,
    SandboxException,
    TemplateException,
    TimeoutException,
)
from .sandbox.commands.command_handle import (
    CommandExitException,
    CommandResult,
    PtyOutput,
    PtySize,
    Stderr,
    Stdout,
)
from .sandbox.commands.main import ProcessInfo
from .sandbox.filesystem.filesystem import EntryInfo, FileType, WriteInfo
from .sandbox.filesystem.watch_handle import (
    FilesystemEvent,
    FilesystemEventType,
)
from .sandbox.network import ALL_TRAFFIC
from .sandbox.sandbox_api import (
    GitHubMcpServer,
    GitHubMcpServerConfig,
    McpServer,
    SandboxInfo,
    SandboxMetrics,
    SandboxNetworkOpts,
    SandboxQuery,
    SandboxState,
)
from .sandbox_async.commands.command_handle import AsyncCommandHandle
from .sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from .sandbox_async.main import AsyncSandbox
from .sandbox_async.paginator import AsyncSandboxPaginator
from .sandbox_async.utils import OutputHandler
from .sandbox_sync.commands.command_handle import CommandHandle
from .sandbox_sync.filesystem.watch_handle import WatchHandle
from .sandbox_sync.main import Sandbox
from .sandbox_sync.paginator import SandboxPaginator
from .template.logger import (
    LogEntry,
    LogEntryEnd,
    LogEntryLevel,
    LogEntryStart,
    default_build_logger,
)
from .template.main import TemplateBase, TemplateClass
from .template.readycmd import (
    ReadyCmd,
    wait_for_file,
    wait_for_port,
    wait_for_process,
    wait_for_timeout,
    wait_for_url,
)
from .template.types import BuildInfo, CopyItem
from .template_async.main import AsyncTemplate
from .template_sync.main import Template

__all__ = [
    # API
    "ApiClient",
    "client",
    # Connection config
    "ConnectionConfig",
    "ProxyTypes",
    # Exceptions
    "SandboxException",
    "TimeoutException",
    "NotFoundException",
    "AuthenticationException",
    "InvalidArgumentException",
    "NotEnoughSpaceException",
    "TemplateException",
    "BuildException",
    "FileUploadException",
    # Sandbox API
    "SandboxInfo",
    "SandboxMetrics",
    "ProcessInfo",
    "SandboxQuery",
    "SandboxState",
    "SandboxMetrics",
    # Command handle
    "CommandResult",
    "Stderr",
    "Stdout",
    "CommandExitException",
    "PtyOutput",
    "PtySize",
    # Filesystem
    "FilesystemEvent",
    "FilesystemEventType",
    "EntryInfo",
    "WriteInfo",
    "FileType",
    # Network
    "SandboxNetworkOpts",
    "ALL_TRAFFIC",
    # Sync sandbox
    "Sandbox",
    "SandboxPaginator",
    "WatchHandle",
    "CommandHandle",
    # Async sandbox
    "OutputHandler",
    "AsyncSandboxPaginator",
    "AsyncSandbox",
    "AsyncWatchHandle",
    "AsyncCommandHandle",
    # Template
    "Template",
    "AsyncTemplate",
    "TemplateBase",
    "TemplateClass",
    "CopyItem",
    "BuildInfo",
    "ReadyCmd",
    "wait_for_file",
    "wait_for_url",
    "wait_for_port",
    "wait_for_process",
    "wait_for_timeout",
    "LogEntry",
    "LogEntryStart",
    "LogEntryEnd",
    "LogEntryLevel",
    "default_build_logger",
    # MCP
    "McpServer",
    "GitHubMcpServer",
    "GitHubMcpServerConfig",
]
