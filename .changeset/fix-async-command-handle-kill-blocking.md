---
"@e2b/python-sdk": patch
---

Fix `AsyncCommandHandle.wait()` blocking after `kill()`: `_iterate_events` now returns immediately after the "end" event, so `wait()` completes promptly even if the gRPC stream is slow to close.
