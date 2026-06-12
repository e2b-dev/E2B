---
"e2b": patch
---

Report a clean exit (no error) to the `WatchHandle` `onExit` callback when the watch is stopped via `stop()`. Previously stopping the watch aborted the event stream and surfaced a misleading `TimeoutError` to `onExit`
