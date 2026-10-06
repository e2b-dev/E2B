---
'@e2b/python-sdk': patch
'e2b': patch
---

Add `SandboxUnreachableError` (JS) / `SandboxUnreachableException` (Python), raised when the sandbox cannot be reached while it is not confirmed to be stopped: the proxy in front of the sandbox reports it running but envd's port not open (e.g. the sandbox's network is down), or a request to the sandbox fails at the connection level and the follow-up health probe gets no answer either. It is a subclass of the sandbox-timeout `TimeoutError` / `TimeoutException` these cases surfaced as before, so existing `instanceof TimeoutError` / `except TimeoutException` handling keeps working. `isRunning()` / `is_running()` still return `false` for such a sandbox.

A `502 "The sandbox was not found"` from the proxy in front of the sandbox (the sandbox was killed or reached its end of life) now raises `SandboxNotFoundError` / `SandboxNotFoundException` from every request, instead of the sandbox-timeout `TimeoutError` / `TimeoutException` — a request whose connection dropped because the sandbox was killed raises it too. Code catching `TimeoutError` for a killed sandbox must catch `SandboxNotFoundError` (a `NotFoundError`) instead. Other 502s keep raising the sandbox-timeout error.

Requests whose connection to the sandbox could not be established now run the same health probe as requests whose connection was dropped mid-request, so a killed sandbox surfaces as a `TimeoutError` instead of a raw connection error. In JS this also covers the opaque `TypeError` browsers raise for network failures (`Failed to fetch`, `Load failed`, `NetworkError when attempting to fetch resource.`).

JS: starting a command, PTY or directory watch on a sandbox whose envd answers `Unavailable` goes through the regular RPC error mapping like every other request (`SandboxNotFoundError` when the sandbox was not found, `SandboxUnreachableError` when it is running but envd's port is not open, sandbox-timeout `TimeoutError` otherwise), instead of always `SandboxNotFoundError: Sandbox is probably not running anymore`. This matches the Python SDK and gives the CLI (`sandbox exec` / `connect`) a correct error.
