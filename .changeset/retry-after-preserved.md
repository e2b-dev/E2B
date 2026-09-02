---
'e2b': patch
'@e2b/python-sdk': patch
---

Preserve the `Retry-After` header on 429 rate-limit errors so callers can wait for the server-specified cooldown instead of retrying immediately.
