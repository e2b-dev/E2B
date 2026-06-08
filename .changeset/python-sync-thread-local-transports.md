---
"@e2b/python-sdk": patch
---

Use thread-local sync HTTP transports to avoid sharing HTTP/2 connection state across Python threads.
