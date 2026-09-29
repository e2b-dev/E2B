---
'e2b': patch
---

fix(js-sdk): treat `WatchHandle.stop()` as a clean watch end - `onExit` now fires with no error instead of a `TimeoutError` blaming `requestTimeoutMs`, matching the Python SDK behavior.
