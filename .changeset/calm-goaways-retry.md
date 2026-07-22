---
'e2b': patch
'@e2b/python-sdk': patch
---

Prefer Undici 8 on Node 22.19 and newer so graceful HTTP/2 `GOAWAY` frames drain accepted requests instead of failing them. Python control-plane clients retry one graceful `GOAWAY` for bodyless GET and HEAD requests.
