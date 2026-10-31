---
"@e2b/python-sdk": patch
---

Notify `on_exit` when an async filesystem watch is stopped immediately after it starts, before its background task runs. Keep exit notification once-only when stopping again or stopping an already finished watch.
