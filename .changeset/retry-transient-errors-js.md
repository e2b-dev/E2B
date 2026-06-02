---
'e2b': minor
---

feat(js-sdk): automatically retry requests on transient failures. The SDK now retries on connection errors and `429`/`502`/`503`/`504` responses using exponential backoff with jitter, and honors a server-provided `Retry-After` header (so rate limiting is handled transparently). Idempotent requests are retried on any transient failure; non-idempotent requests (e.g. `Sandbox.create`) are only retried when the server provably did not process them (e.g. throttling). Configure via the new `retries` option (or `E2B_MAX_RETRIES` env var); set `retries: 0` to disable. Defaults to `3` retries.
