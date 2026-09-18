---
"e2b": patch
---

Retry control-plane HTTP requests after `502` and `503` responses, in addition to `429`. `Retry-After` is honored when the server sends one; otherwise retries back off exponentially with jitter, starting at 500 ms. The existing `retries` option (default 3, `0` to disable) and request-timeout budget apply to all of them.
