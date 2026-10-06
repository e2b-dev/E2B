---
'@e2b/python-sdk': patch
'e2b': patch
---

Add `SandboxUnreachableError` (JS) / `SandboxUnreachableException` (Python), raised when a request to the sandbox fails at the connection level and the follow-up health probe gets no answer from the sandbox either. Requests whose connection to the sandbox could not be established now run the same health probe as requests whose connection was dropped mid-request, so a killed sandbox surfaces as a `TimeoutError` instead of a raw connection error. In JS this also covers the opaque `TypeError` browsers raise for network failures (`Failed to fetch`, `Load failed`, `NetworkError when attempting to fetch resource.`).


JS: starting a command, PTY or directory watch on a sandbox whose envd answers `Unavailable` (e.g. its network is down) now raises the sandbox-timeout `TimeoutError` like every other request, instead of `SandboxNotFoundError: Sandbox is probably not running anymore`. This matches the Python SDK and gives the CLI (`sandbox exec` / `connect`) a correct error.
