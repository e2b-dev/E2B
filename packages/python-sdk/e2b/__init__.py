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
    SandboxException,
    TimeoutException,
    NotFoundException,
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    TemplateException,
    BuildException,
    FileUploadException,
)
from .sandbox.commands.command_handle import (
    CommandResult,
    Stderr,
    Stdout,
    CommandExitException,
    PtyOutput,
    PtySize,
)
from .sandbox.commands.main import ProcessInfo
from .sandbox.filesystem.filesystem import EntryInfo, WriteInfo, FileType
from .sandbox.filesystem.watch_handle import (
    FilesystemEvent,
    FilesystemEventType,
)
from .sandbox.mcp import McpServer
from .sandbox.sandbox_api import SandboxInfo, SandboxQuery, SandboxState, SandboxMetrics
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
    LogEntryLevel,
    LogEntryStart,
    LogEntryEnd,
    default_build_logger,
)
from .template.main import TemplateBase, TemplateClass
from .template.readycmd import (
    wait_for_file,
    wait_for_url,
    wait_for_port,
    wait_for_process,
    wait_for_timeout,
)
from .template.types import CopyItem
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
]
