"""
Secure sandboxed cloud environments made for AI agents and AI apps

Check usage docs - https://e2b.dev/docs/sandbox/overview

E2B Sandbox is a secure sandboxed cloud environment made for AI agents and AI
apps. Sandboxes allow AI agents and apps to have long running cloud secure
environments. In these environments, large language models can use the same
tools as humans do.


```py
from e2b import Sandbox

# Create sandbox
sandbox = Sandbox()

# Let an LLM use the sandbox here

# Close sandbox once done
sandbox.close()
```
"""


from .api import (
    E2BApiClient,
    client,
)
from .constants import (
    SANDBOX_DOMAIN,
    API_HOST,
)
from .sandbox import (
    Sandbox,
    FilesystemOperation,
    FilesystemWatcher,
    FileInfo,
    FilesystemEvent,
    FilesystemManager,
    TerminalManager,
    Terminal,
    ProcessManager,
    Process,
    OpenPort,
    Action,
    EnvVars,
    SandboxException,
    TerminalException,
    ProcessException,
    CurrentWorkingDirectoryDoesntExistException,
    FilesystemException,
    RpcException,
    ProcessMessage,
    ProcessOutput,
    TerminalOutput,
    run_code,
)
from .templates import (
    DataAnalysis,
    CodeInterpreter,
)
