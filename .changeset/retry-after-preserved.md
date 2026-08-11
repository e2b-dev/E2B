---
"e2b": patch
"@e2b/python-sdk": patch
---

Preserve the `Retry-After` header on 429 rate-limit errors across the exception
boundary. Both SDKs now parse the header and surface it as `retryAfter` /
`retry_after` plus `retryAfterHeader` / `retry_after_header` on
`RateLimitError` / `RateLimitException`, and append a wait hint to the error
message, so callers can back off instead of retrying immediately.
