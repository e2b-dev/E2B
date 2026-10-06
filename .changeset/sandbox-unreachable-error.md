---
'@e2b/python-sdk': patch
'e2b': patch
---

Classify requests that fail because the sandbox cannot be reached. Two new error classes, both subclasses of the sandbox-timeout `TimeoutError` (JS) / `TimeoutException` (Python) these cases surfaced as before, so existing `instanceof TimeoutError` / `except TimeoutException` handling keeps working:

- `SandboxNotRunningError` / `SandboxNotRunningException` — the proxy in front of the sandbox answered `502 "The sandbox was not found"` (killed or reached its timeout), from any envd request (RPC or files API) or from the health probe run after a request failed at the connection level (e.g. the sandbox killed while a command was running).
- `SandboxUnreachableError` / `SandboxUnreachableException` — the sandbox is not confirmed stopped but cannot be reached: the proxy reports it running but envd's port not open (e.g. `ip link set eth0 down` inside the sandbox), any other `502`, or a request failed at the connection level and the follow-up health probe got no answer either. The failed request is the error's `cause` / `__cause__`.

Requests whose connection could not be established (`ECONNREFUSED`, DNS, unreachable host, browsers' `Failed to fetch`, `httpx.ConnectError`, …) now run the same health probe as requests whose connection dropped mid-request; when the probe says the sandbox is running (or is inconclusive) the original transport error is raised unchanged. `isRunning()` / `is_running()` still return `false` for any `502`.

JS: starting a command, PTY or directory watch on a sandbox that is gone raises `SandboxNotRunningError` instead of `SandboxNotFoundError: Sandbox is probably not running anymore`, like every other request (Python: `SandboxNotRunningException` instead of `TimeoutException`). The CLI's `sandbox exec` / `sandbox connect` print that error instead of a stack trace. Plain-text `502` bodies keep the proxy's message in JS, matching Python.
