---
"e2b": patch
"@e2b/python-sdk": patch
---

Expose `Retry-After` on rate-limit errors. `RateLimitError`/`RateLimitException` now carries `retryAfter`/`retry_after` (seconds), parsed from the `Retry-After` header on 429 responses from both the main API and the envd API. `undefined`/`None` when the header is absent or unparsable.
