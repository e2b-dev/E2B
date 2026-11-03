---
'e2b': patch
---

Fix `TypeError: fetch failed` with `NGHTTP2_ENHANCE_YOUR_CALM` on concurrent `files.write()` calls. Node's HTTP/2 client charges queued request bodies against a 10 MB per-session budget and resets whichever stream's response arrives while it is exhausted; since undici 8 every envd REST request of a process shared one session. envd REST dispatchers now carry one request per HTTP/2 session (spread over the connection pool, as with undici 7), and a dispatcher whose session Node reports as out of memory is retired and replaced instead of failing every later request.
