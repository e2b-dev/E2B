---
'e2b': minor
'@e2b/python-sdk': minor
---

Retry control-plane API errors marked `Should-Retry: true`, or 429/502/503/504 responses without the header (e.g. from a load balancer); `Should-Retry: false` is never retried.

- Removes method and replayable-operation retry allowlists
- Post-send network errors are no longer retried; connection failures still are
