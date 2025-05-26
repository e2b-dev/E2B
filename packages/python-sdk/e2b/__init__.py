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
sandbox = Sandbox()
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
from .sandbox.filesystem.filesystem import EntryInfo, FileType
from .sandbox.filesystem.watch_handle import (
    FilesystemEvent,
    FilesystemEventType,
)
from .sandbox.sandbox_api import SandboxInfo
from .sandbox_async.commands.command_handle import AsyncCommandHandle
from .sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from .sandbox_async.main import AsyncSandbox
from .sandbox_async.utils import OutputHandler
from .sandbox_sync.commands.command_handle import CommandHandle
from .sandbox_sync.filesystem.watch_handle import WatchHandle
from .sandbox_sync.main import Sandbox

__all__ = [
    "ApiClient",
    "client",
    "ConnectionConfig",
    "ProxyTypes",
    "AuthenticationException",
    "InvalidArgumentException",
    "NotEnoughSpaceException",
    "NotFoundException",
    "SandboxException",
    "TemplateException",
    "TimeoutException",
    "CommandExitException",
    "CommandResult",
    "PtyOutput",
    "PtySize",
    "Stderr",
    "Stdout",
    "ProcessInfo",
    "EntryInfo",
    "FileType",
    "FilesystemEvent",
    "FilesystemEventType",
    "SandboxInfo",
    "AsyncCommandHandle",
    "AsyncWatchHandle",
    "AsyncSandbox",
    "OutputHandler",
    "CommandHandle",
    "WatchHandle",
    "Sandbox",
]
