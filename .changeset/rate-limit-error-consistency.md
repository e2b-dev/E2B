---
"e2b": patch
---

Return a dedicated rate limit error for HTTP 429 responses from the envd API. Previously these were surfaced as a generic sandbox error, unlike the main API client which already raised `RateLimitError` (JS) / `RateLimitException` (Python). Rate limit errors are now consistent across all SDK request paths.
