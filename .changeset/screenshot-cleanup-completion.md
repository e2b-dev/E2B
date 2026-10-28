---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

Wait for temporary screenshot cleanup before returning in JavaScript. Attempt cleanup after capture or read failures in both desktop SDKs without replacing the original error.
