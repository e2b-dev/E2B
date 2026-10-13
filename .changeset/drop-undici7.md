---
'e2b': minor
'@e2b/cli': minor
'@e2b/code-interpreter': minor
'@e2b/desktop': minor
---

Require Node.js 22.19.0 or newer and depend on `undici@^8` only (undici 7 is dropped).

- undici 8 respects the server's HTTP/2 `SETTINGS_MAX_CONCURRENT_STREAMS` and opens more connections when one is saturated.
- Breaking: the SDK-level in-flight request cap is removed, along with the `E2B_API_INFLIGHT_REQUESTS`, `E2B_ENVD_INFLIGHT_REQUESTS` and `E2B_ENVD_RPC_INFLIGHT_REQUESTS` env vars. Concurrency is governed by undici's connection pools (`E2B_API_CONNECTIONS`, `E2B_ENVD_RPC_CONNECTIONS`).
