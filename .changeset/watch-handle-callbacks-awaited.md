---
"e2b": patch
---

Await async `onEvent` and `onExit` callbacks in `WatchHandle` so filesystem events are handled sequentially and callback errors are routed to `onExit`
