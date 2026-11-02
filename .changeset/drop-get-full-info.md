---
'e2b': minor
---

Remove the deprecated `Sandbox.getFullInfo()`; use `Sandbox.getInfo()` instead, which returns the same `SandboxInfo`. Breaking for callers still using `getFullInfo`.
