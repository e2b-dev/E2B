---
'@e2b/python-sdk': minor
'e2b': minor
---

Add `SandboxNotRunningError` / `SandboxNotRunningException` and `SandboxUnreachableError` / `SandboxUnreachableException` for envd requests that fail because the sandbox cannot be reached. Both extend `TimeoutError` / `TimeoutException`, which these cases raised before, so existing `instanceof TimeoutError` / `except TimeoutException` handling keeps working.

- `SandboxNotRunning*` — the proxy answered `502 "The sandbox was not found"` (killed, paused or timed out), either directly or from the health probe the SDK runs after a dropped connection or an unexplained `Unavailable` (e.g. the sandbox was killed mid-command). Retrying will not help.
- `SandboxUnreachable*` — the sandbox is not confirmed stopped but cannot be reached: `502 "port is not open"`, other `502`s, or a connection failure whose health probe got no answer. The original error is the `cause` / `__cause__`.
- A connection failure whose health probe finds the sandbox running still raises the original transport error. The probe itself runs without connection retries.

**Breaking (JS):** `commands.run` / `connect`, `pty.create` / `connect` and `files.watchDir` on a gone sandbox now throw `SandboxNotRunningError` instead of `SandboxNotFoundError`, like every other call. `SandboxNotFoundError` is only raised by the control plane API.
