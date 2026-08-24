---
'e2b': major
---

Drop the dual `undici`/`undici8` dependency: the SDK now depends on `undici@^8` only and requires Node.js >= 22.19.0. undici 8 honors the server's `SETTINGS_MAX_CONCURRENT_STREAMS` per HTTP/2 connection and opens additional connections when a connection's streams are saturated, instead of undici 7's one-request-per-connection multiplexing. On Node.js older than 22.19.0 the SDK no longer loads undici and falls back to the global fetch.

Remove the SDK-level in-flight request cap: `limitConcurrency` and the `E2B_API_INFLIGHT_REQUESTS`, `E2B_ENVD_INFLIGHT_REQUESTS`, and `E2B_ENVD_RPC_INFLIGHT_REQUESTS` env vars are gone. Concurrency is now governed by undici's dispatcher (per-connection HTTP/2 stream limits from the server plus the `E2B_API_CONNECTIONS`/`E2B_ENVD_RPC_CONNECTIONS` connection pools).
