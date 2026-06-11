---
'e2b': patch
'@e2b/python-sdk': patch
---

Raise typed, actionable errors when the sandbox is killed or expires while a request is in flight. Streaming RPC calls (commands, PTY, directory watch) and filesystem read/write now surface a `SandboxError`/`SandboxException` explaining that the sandbox was likely killed and pointing to `isRunning()`/`is_running()`, instead of a cryptic `2: [unknown] terminated` (JS) or a raw `httpcore.RemoteProtocolError` (Python). Other transport-level errors in the Python SDK are now wrapped in `SandboxException` instead of leaking raw `httpcore`/`httpx` exceptions.
