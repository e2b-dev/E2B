---
"@e2b/python-sdk": minor
---

Align the sync and async Python SDK implementations: consistent parameter ordering (`_create`, `Commands._start`), matching docstrings, keyword arguments in `Filesystem.write`, and a consistent bare `Exception` for the internal "Body of the request is None" guard (matching the volume client).

`Sandbox.pause()` / `AsyncSandbox.pause()` (and `beta_pause`) now return a `bool` — `True` if the sandbox got paused, `False` if it was already paused — matching the JS SDK. Previously the instance method returned `None` and the class-method form returned the sandbox ID.
