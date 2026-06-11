---
'e2b': patch
'@e2b/python-sdk': patch
---

Raise a typed, actionable error when the sandbox dies while a request is in flight. When the connection is dropped mid-request (streaming RPC calls — commands, PTY, directory watch — and filesystem read/write), the SDKs now probe the sandbox health endpoint: if the sandbox is confirmed gone, a `TimeoutError` (JS) / `TimeoutException` (Python) is raised stating the sandbox was killed or reached its end of life — consistent with how requests to an already-dead sandbox surface. In all other cases the original error propagates unchanged.
