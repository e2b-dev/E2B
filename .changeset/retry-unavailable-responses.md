---
"e2b": patch
---

Retry control-plane HTTP requests after `502` and `503` responses and failures to establish the connection (connection refused, DNS, unreachable host), in addition to `429`. `Retry-After` is honored when the server sends one; otherwise retries back off exponentially with jitter, starting at 100 ms and capped at 10 s. The existing `retries` option (default 3, `0` to disable) and request-timeout budget apply to all of them.
