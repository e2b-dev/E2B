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
    ApiParams,
    ConnectionConfig,
    ProxyTypes,
    Username,
)
from .volume.connection_config import VolumeApiParams, VolumeConnectionConfig
from .exceptions import (
    AuthenticationException,
    FileNotFoundException,
    GitAuthException,
    GitUpstreamException,
    BuildException,
    FileUploadException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    NotFoundException,
    RateLimitException,
    SandboxException,
    SandboxNotFoundException,
    TemplateException,
    TimeoutException,
    VolumeException,
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
from .sandbox._git import GitBranches, GitFileStatus, GitStatus
from .sandbox_sync.git import Git
from .sandbox.network import ALL_TRAFFIC
from .sandbox.signature import get_signature
from .sandbox.sandbox_api import (
    GitHubMcpServer,
    GitHubMcpServerConfig,
    McpServer,
    SandboxInfo,
    SandboxInfoLifecycle,
    SandboxMetrics,
    SandboxLifecycle,
    SandboxNetworkOpts,
    SandboxQuery,
    SandboxState,
    SnapshotInfo,
)
from .sandbox_async.commands.command_handle import AsyncCommandHandle
from .sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from .sandbox_async.main import AsyncSandbox
from .sandbox_async.paginator import AsyncSandboxPaginator, AsyncSnapshotPaginator
from .sandbox_async.utils import OutputHandler
from .sandbox_sync.commands.command_handle import CommandHandle
from .sandbox_sync.filesystem.watch_handle import WatchHandle
from .sandbox_sync.main import Sandbox
from .sandbox_sync.paginator import SandboxPaginator, SnapshotPaginator
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
from .template.types import (
    BuildInfo,
    BuildStatusReason,
    CopyItem,
    TemplateBuildStatus,
    TemplateBuildStatusResponse,
    TemplateTag,
    TemplateTagInfo,
)
from .template_async.main import AsyncTemplate
from .template_sync.main import Template

from .volume.volume_sync import Volume
from .volume.volume_async import AsyncVolume
from .volume.types import (
    VolumeInfo,
    VolumeAndToken,
    VolumeEntryStat,
    VolumeFileType,
)

__all__ = [
    # API
    "ApiClient",
    "client",
    # Connection config
    "ConnectionConfig",
    "VolumeConnectionConfig",
    "ProxyTypes",
    "ApiParams",
    "VolumeApiParams",
    "Username",
    # Exceptions
    "SandboxException",
    "TimeoutException",
    "NotFoundException",
    "FileNotFoundException",
    "SandboxNotFoundException",
    "AuthenticationException",
    "GitAuthException",
    "GitUpstreamException",
    "InvalidArgumentException",
    "NotEnoughSpaceException",
    "TemplateException",
    "BuildException",
    "FileUploadException",
    "RateLimitException",
    "VolumeException",
    # Sandbox API
    "SandboxInfo",
    "SandboxInfoLifecycle",
    "SandboxMetrics",
    "ProcessInfo",
    "SandboxQuery",
    "SandboxState",
    "SandboxMetrics",
    "GitStatus",
    "GitBranches",
    "GitFileStatus",
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
    "SandboxLifecycle",
    "ALL_TRAFFIC",
    # Snapshot
    "SnapshotInfo",
    "SnapshotPaginator",
    "AsyncSnapshotPaginator",
    # Signature
    "get_signature",
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
    "BuildStatusReason",
    "TemplateBuildStatus",
    "TemplateBuildStatusResponse",
    "TemplateTag",
    "TemplateTagInfo",
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
    # Git
    "Git",
    # Volume
    "Volume",
    "AsyncVolume",
    "VolumeInfo",
    "VolumeAndToken",
    "VolumeEntryStat",
    "VolumeFileType",
]
