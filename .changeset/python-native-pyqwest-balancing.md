---
"@e2b/python-sdk": minor
---

Balance HTTP/2 streams with pyqwest's native connection pool instead of a Python-side balancer over multiple transports. The pool dials a new connection once every existing one is at the server-advertised concurrent-stream limit, capped at `E2B_MAX_CONNECTIONS` (default `200`) connections per resolved address. `E2B_STREAMS_PER_CONNECTION` is removed — the limit now comes from the server's `SETTINGS_MAX_CONCURRENT_STREAMS`.
