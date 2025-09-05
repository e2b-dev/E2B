---
'@e2b/python-sdk': minor
'e2b': minor
---

fixed authentication error handling to properly raise `AuthenticationError` instead of `SandboxError` for 401 errors.
