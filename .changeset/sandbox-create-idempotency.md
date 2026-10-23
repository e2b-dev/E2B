---
'e2b': minor
'@e2b/python-sdk': minor
---

- Added an `idempotencyKey` (JavaScript) and `idempotency_key` (Python) option
  to `Sandbox.create` that sends `Idempotency-Key` on sandbox creation. Keys
  must contain 1–255 lowercase ASCII letters, digits or hyphens.
