---
"e2b": patch
---

Fix `Sandbox.getMetrics()` sending `start` and `end` as path parameters instead of query parameters, which caused the requested time range to be silently ignored
