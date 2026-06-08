---
"@e2b/python-sdk": patch
---

Align the sync and async Python SDK implementations: consistent parameter ordering (`_create`, `Commands._start`), matching docstrings, keyword arguments in `Filesystem.write`, and a consistent bare `Exception` for the internal "Body of the request is None" guard (matching the volume client).
