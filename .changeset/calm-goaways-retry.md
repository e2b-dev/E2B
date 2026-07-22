---
'e2b': patch
---

Prefer Undici 8 on Node 22.19 and newer so graceful HTTP/2 `GOAWAY` frames drain accepted requests instead of failing them, while retaining Undici 7 as the Node 20 fallback.
