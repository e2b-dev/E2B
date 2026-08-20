---
'e2b': major
---

Drop the dual `undici`/`undici8` dependency: the SDK now depends on `undici@^8` only and requires Node.js >= 22.19.0. undici 8 honors the server's `SETTINGS_MAX_CONCURRENT_STREAMS` per HTTP/2 connection and opens additional connections when a connection's streams are saturated, instead of undici 7's one-request-per-connection multiplexing. On Node.js older than 22.19.0 the SDK no longer loads undici and falls back to the global fetch (still subject to the in-flight cap).
