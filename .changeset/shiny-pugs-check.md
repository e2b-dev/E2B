---
"e2b": patch
---

Raise an error for non-2xx API and envd responses with empty bodies (e.g. `Content-Length: 0`) instead of treating them as successful.
