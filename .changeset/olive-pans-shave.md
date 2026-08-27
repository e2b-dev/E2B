---
'@e2b/code-interpreter': patch
---

Detect a mid-request sandbox kill on Deno, where the disconnect surfaces as a bare `TypeError` message instead of a socket error code, so `runCode` throws the descriptive `TimeoutError` there too
