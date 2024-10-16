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
)
from .exceptions import (
    SandboxException,
    TimeoutException,
    NotFoundException,
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    TemplateException,
)
from .sandbox.sandbox_api import SandboxInfo
from .sandbox.commands.main import ProcessInfo
from .sandbox.commands.command_handle import (
    CommandResult,
    Stderr,
    Stdout,
    CommandExitException,
    PtyOutput,
    PtySize,
)
from .sandbox.filesystem.watch_handle import (
    FilesystemEvent,
    FilesystemEventType,
)
from .sandbox.filesystem.filesystem import EntryInfo, FileType

from .sandbox_sync.main import Sandbox
from .sandbox_sync.filesystem.watch_handle import WatchHandle
from .sandbox_sync.commands.command_handle import CommandHandle

from .sandbox_async.utils import OutputHandler
from .sandbox_async.main import AsyncSandbox
from .sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from .sandbox_async.commands.command_handle import AsyncCommandHandle
