---
"e2b": patch
---

Report a clean exit (no error) to the `WatchHandle` `onExit` callback when the watch is stopped via `stop()`. Previously stopping the watch aborted the event stream and surfaced a misleading `TimeoutError` to `onExit`. `stop()` now also resolves only after the watching has fully ended and `onExit` has completed, re-throwing errors raised by `onExit`; an in-flight `onEvent` callback is abandoned on stop, matching the cancellation semantics of the Python SDK
