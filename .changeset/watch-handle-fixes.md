---
"@e2b/python-sdk": patch
"e2b": patch
---

Fix three filesystem watch handle bugs:

- **JS**: `WatchHandle` now awaits async `onEvent`/`onExit` callbacks. A rejecting async `onEvent` is routed to `onExit` and stops the watch instead of becoming an unhandled promise rejection that can crash Node, and async callbacks get backpressure/ordering — matching `CommandHandle`.
- **Python (sync)**: `WatchHandle.get_new_events()` and `stop()` now send a request timeout (default 60s, overridable via `request_timeout`) so a stalled call can't hang the thread forever, and include the authentication header so the polling/stop calls aren't sent unauthenticated on older envd.
- **Python (async)**: `AsyncWatchHandle` now invokes `on_exit` when the stream ends cleanly (with `None`) and when `stop()` is called, in addition to on error — matching the JS SDK.
