---
"@e2b/python-sdk": patch
---

Retry control-plane HTTP requests after `502` and `503` responses, in addition to `429`, and after a network error once the request was written (dropped connection) — except for operations the API spec does not declare idempotent (`x-idempotent: false`, or a `POST` without the annotation: sandbox creation, fork, snapshot, volume/secret creation), which the server may already have processed. Failures to establish the connection keep being retried for every operation (`E2B_CONNECTION_RETRIES`). `Retry-After` is honored when the server sends one; otherwise retries back off exponentially with jitter, starting at 0.1 seconds and capped at 10 seconds. The existing `retries` option (default 3, `0` to disable) and request-timeout budget apply to all of them.
