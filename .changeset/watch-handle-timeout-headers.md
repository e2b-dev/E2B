---
"@e2b/python-sdk": patch
---

Apply request timeout and user authentication headers to sync `WatchHandle.get_new_events` and `WatchHandle.stop` requests, and allow overriding the timeout via a new `request_timeout` parameter
