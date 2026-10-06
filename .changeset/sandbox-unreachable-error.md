---
'@e2b/python-sdk': patch
'e2b': patch
---

Add `SandboxUnreachableError` (JS) / `SandboxUnreachableException` (Python), raised when the sandbox cannot be reached while it is not confirmed to be stopped: the proxy in front of the sandbox reports it running but envd's port not open (e.g. the sandbox's network is down), or a request to the sandbox fails at the connection level and the follow-up health probe gets no answer either. It is a subclass of the sandbox-timeout `TimeoutError` / `TimeoutException` these cases surfaced as before, so existing `instanceof TimeoutError` / `except TimeoutException` handling keeps working. `isRunning()` / `is_running()` still return `false` for such a sandbox.

Requests whose connection to the sandbox could not be established now run the same health probe as requests whose connection was dropped mid-request, so a killed sandbox surfaces as a `TimeoutError` instead of a raw connection error. In JS this also covers the opaque `TypeError` browsers raise for network failures (`Failed to fetch`, `Load failed`, `NetworkError when attempting to fetch resource.`).

JS: starting a command, PTY or directory watch on a sandbox whose envd answers `Unavailable` goes through the regular RPC error mapping like every other request (`SandboxUnreachableError` when the sandbox is running but envd's port is not open, sandbox-timeout `TimeoutError` otherwise), instead of `SandboxNotFoundError: Sandbox is probably not running anymore`. This matches the Python SDK and gives the CLI (`sandbox exec` / `connect`) a correct error.
