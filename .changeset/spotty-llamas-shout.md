---
'e2b': patch
'@e2b/python-sdk': patch
---

Raise typed, actionable errors when the connection to the sandbox is dropped while a request is in flight. Streaming RPC calls (commands, PTY, directory watch) and filesystem read/write now probe the sandbox health endpoint: when the sandbox is confirmed gone, they raise a `SandboxError`/`SandboxException` stating the sandbox was killed or reached its end of life; otherwise they raise a plain typed error — instead of a raw `httpcore.RemoteProtocolError` (Python). Other transport-level errors in the Python SDK are now wrapped in `SandboxException` instead of leaking raw `httpcore`/`httpx` exceptions.
