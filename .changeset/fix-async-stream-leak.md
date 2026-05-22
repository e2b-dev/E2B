---
"@e2b/python-sdk": patch
---

fix(python-sdk): close gRPC streams on `AsyncWatchHandle.stop()` and `AsyncCommandHandle.disconnect()`

`stop()` / `disconnect()` previously only cancelled the consumer task and left the underlying server-streaming RPC open (the `await self._events.aclose()` was commented out as a Python 3.8 workaround). On long-lived sandboxes this leaked file descriptors and eventually produced `Code.internal: error creating watcher: too many open files`. Python 3.8 is no longer supported (`pyproject.toml` pins `^3.10`), so the workaround is removed and the streams are now closed explicitly.
