---
'@e2b/code-interpreter': patch
---

Detect a mid-request sandbox kill on Cloudflare Workers, where workerd reports the disconnect as `Network connection lost.` instead of a socket error code, so `runCode` throws the descriptive `TimeoutError` there too
