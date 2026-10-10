---
'e2b': patch
'@e2b/python-sdk': patch
---

After a command or PTY handle is disconnected before the command finished, `wait()` now fails with a `SandboxError` / `SandboxException` saying the handle was disconnected, instead of a `TimeoutError` blaming `requestTimeoutMs` (JS), a `CancelledError` in a task nobody cancelled (async Python), or a bare `Exception` (sync Python).
