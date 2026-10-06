---
'@e2b/python-sdk': patch
'e2b': patch
---

Add `SandboxUnreachableError` (JS) / `SandboxUnreachableException` (Python), raised when the sandbox cannot be reached while it is not confirmed to be stopped: the proxy in front of the sandbox reports it running but envd's port not open (e.g. the sandbox's network is down), or a request to the sandbox fails at the connection level and the follow-up health probe gets no answer either. It is a subclass of the sandbox-timeout `TimeoutError` / `TimeoutException` these cases surfaced as before, so existing `instanceof TimeoutError` / `except TimeoutException` handling keeps working. `isRunning()` / `is_running()` still return `false` for such a sandbox.

Every `502` / `Unavailable` answered by the proxy in front of the sandbox — the sandbox was not found (killed or reached its timeout) or it is running but envd's port is not open (e.g. `ip link set eth0 down` inside it) — now raises `SandboxUnreachableError` / `SandboxUnreachableException` from every envd request, as does a request whose connection dropped because the sandbox was killed. The new error extends `TimeoutError` / `TimeoutException`, so existing timeout handling keeps working. Starting a command / PTY / directory watch on a sandbox the proxy reports as not found keeps raising `SandboxNotFoundError` in JS and now raises `SandboxNotFoundException` in Python (instead of `TimeoutException`).

Requests whose connection to the sandbox could not be established now run the same health probe as requests whose connection was dropped mid-request, so a killed sandbox surfaces as a `TimeoutError` instead of a raw connection error. In JS this also covers the opaque `TypeError` browsers raise for network failures (`Failed to fetch`, `Load failed`, `NetworkError when attempting to fetch resource.`).

JS: starting a command, PTY or directory watch on a sandbox whose envd answers `Unavailable` goes through the regular RPC error mapping like every other request (`SandboxNotFoundError` with the proxy's message when the sandbox was not found, `SandboxUnreachableError` otherwise), instead of always `SandboxNotFoundError: Sandbox is probably not running anymore`. This matches the Python SDK and gives the CLI (`sandbox exec` / `connect`) a correct error.
