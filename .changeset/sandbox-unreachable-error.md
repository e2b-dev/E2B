---
'@e2b/python-sdk': minor
'e2b': minor
---

Classify requests that fail because the sandbox cannot be reached. Two new error classes, both subclasses of the sandbox-timeout `TimeoutError` (JS) / `TimeoutException` (Python) these cases surfaced as before, so existing `instanceof TimeoutError` / `except TimeoutException` handling keeps working:

- `SandboxNotRunningError` / `SandboxNotRunningException` — the proxy in front of the sandbox answered `502 "The sandbox was not found"` (killed, paused or reached its timeout), or the health probe run after a failed request did. Retrying will not help; create or resume a sandbox.
- `SandboxUnreachableError` / `SandboxUnreachableException` — the sandbox is not confirmed stopped but cannot be reached. The failed request is the error's `cause` / `__cause__`.

What each envd request (RPC or files API) now raises:

| Failure                                                                                                                                                  | JS                                                                                                                                           | Python                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `502` / `Unavailable` "The sandbox was not found"                                                                                                        | `SandboxNotRunningError`                                                                                                                     | `SandboxNotRunningException`  |
| `502` / `Unavailable` "The sandbox is running but port is not open" (e.g. `ip link set eth0 down` inside the sandbox)                                    | `SandboxUnreachableError`                                                                                                                    | `SandboxUnreachableException` |
| any other `Unavailable` (e.g. envd ending a stream because the sandbox was killed mid-command)                                                           | health probe: gone → `SandboxNotRunningError`, otherwise `SandboxUnreachableError` ("state is unknown")                                      | same, with the Python classes |
| any other `502`                                                                                                                                          | `SandboxUnreachableError`                                                                                                                    | `SandboxUnreachableException` |
| connection could not be established or dropped mid-request (`ECONNREFUSED`, DNS, unreachable host, browsers' `Failed to fetch`, `httpx.ConnectError`, …) | health probe: gone → `SandboxNotRunningError`; running or inconclusive → the original transport error; no answer → `SandboxUnreachableError` | same, with the Python classes |

The health probe runs without the SDK's connection retries, so a sandbox that cannot be reached is not tried all over again. **Breaking for JS:** `commands.run` / `connect`, `pty.create` / `connect` and `files.watchDir` on a sandbox that is gone threw `SandboxNotFoundError` ("Sandbox is probably not running anymore"); like every other call they now throw `SandboxNotRunningError` (a `TimeoutError`, not a `NotFoundError`). `SandboxNotFoundError` is only raised by the control plane API. `isRunning()` / `is_running()` still return `false` for any `502`. Plain-text `502` bodies keep the proxy's message in JS, matching Python.
