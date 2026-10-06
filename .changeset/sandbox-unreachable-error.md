---
'@e2b/python-sdk': patch
'e2b': patch
---

Add `SandboxUnreachableError` (JS) / `SandboxUnreachableException` (Python), raised when the sandbox cannot be reached while it is not confirmed to be stopped: the proxy in front of the sandbox reports it running but envd's port not open (e.g. the sandbox's network is down), or a request to the sandbox fails at the connection level and the follow-up health probe gets no answer either. Previously these surfaced as a sandbox-timeout `TimeoutError`/`TimeoutException`, `isRunning()`/`is_running()` returned `false` for a running sandbox and `commands.run()` reported `SandboxNotFoundError`. Requests whose connection to the sandbox could not be established now run the same health probe as requests whose connection was dropped mid-request, so a killed sandbox surfaces as a `TimeoutError` instead of a raw connection error.
