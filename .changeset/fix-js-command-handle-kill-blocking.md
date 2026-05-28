---
'e2b': patch
---

Fix `CommandHandle.wait()` blocking after `kill()`: `iterateEvents` now returns immediately after the "end" event, so `wait()` completes promptly even if the gRPC stream is slow to close.
