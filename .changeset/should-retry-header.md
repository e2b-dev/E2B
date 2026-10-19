---
'e2b': minor
'@e2b/python-sdk': minor
---

Retry control-plane API errors only when the response carries `Should-Retry: true` (honoring `Retry-After`, otherwise exponential backoff)

- Removes the client-side retry allowlists (status codes, methods, replayable operations)
- Responses without `Should-Retry: true` (including 429/502/503) and network errors after the request was sent are no longer retried; connection failures still are
