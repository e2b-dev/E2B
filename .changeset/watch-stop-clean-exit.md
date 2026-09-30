---
"e2b": patch
---

Fire the filesystem watch `onExit` callback with no error when the watch is stopped with `handle.stop()`. Stopping a watch aborts the underlying request, which the transport surfaces as a canceled error — the same code a request timeout maps to — so every clean, user-initiated stop reported a `TimeoutError` telling the user to raise `requestTimeoutMs`. The cancellation `stop()` itself triggers is now treated as the clean end of the watch, matching the Python SDK; a cancellation from anywhere else (e.g. a request timeout) still fires `onExit` with the error.
