---
'e2b': patch
---

Remove the unused `stackTrace` constructor parameter from error classes that never have a caller stack trace attached (`TimeoutError`, `NotEnoughSpaceError`, `NotFoundError`, `FileNotFoundError`, `SandboxNotFoundError`, `GitUpstreamError`).
