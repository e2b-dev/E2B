---
"e2b": minor
"@e2b/python-sdk": minor
---

- `Sandbox.create` sends an `Idempotency-Key` per create call.
- Keyed creates retry after 502/network errors and while the original request is in progress.
