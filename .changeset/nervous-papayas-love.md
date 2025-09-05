---
'@e2b/python-sdk': minor
'e2b': minor
---

Added Templates SDK, new error classes, moved `getRuntime` to utils, and fixed authentication error handling to properly raise `AuthenticationError` instead of `SandboxError` for 401 errors.
