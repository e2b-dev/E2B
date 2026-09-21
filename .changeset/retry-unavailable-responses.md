---
"e2b": patch
---

Retry control-plane HTTP requests after `502` and `503` responses and failures to establish the connection (connection refused, DNS, unreachable host), in addition to `429`. Any other network error (dropped connection, or the opaque `TypeError` browsers and Cloudflare Workers raise) is retried too, except for operations the API spec does not declare idempotent (`x-idempotent: false`, or a `POST` without the annotation: sandbox creation, fork, snapshot, volume/secret creation), which the server may already have processed. `Retry-After` is honored when the server sends one; otherwise retries back off exponentially with jitter, starting at 100 ms and capped at 10 s. The existing `retries` option (default 3, `0` to disable) and request-timeout budget apply to all of them.
