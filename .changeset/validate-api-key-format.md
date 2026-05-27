---
'e2b': patch
'@e2b/python-sdk': patch
---

Validate the E2B API key format client-side. SDKs now throw an `AuthenticationError` / `AuthenticationException` with an example token (e.g. `e2b_0000000000000000000000000000000000000000`) when the key does not start with `e2b_` or is not followed by 40 hex characters.
