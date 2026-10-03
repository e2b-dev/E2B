---
"@e2b/python-sdk": patch
---

Retry requests whose HTTP/2 stream the server refused before processing them — such as ones that cross a `GOAWAY` retiring their connection (e.g. on reaching its maximum age) — instead of failing them.
