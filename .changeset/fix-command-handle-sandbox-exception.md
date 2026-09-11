---
"e2b": patch
---

Raise `SandboxException` instead of bare `Exception` in `CommandHandle.wait()` when the command stream ends without an exit event, giving a clearer error message when the sandbox was killed, paused, or timed out mid-stream.
