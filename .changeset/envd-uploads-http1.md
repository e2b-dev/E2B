---
'e2b': patch
---

Fix `TypeError: fetch failed` / `NGHTTP2_ENHANCE_YOUR_CALM` on concurrent `files.write()` calls. Node's HTTP/2 client queues each request body in full against a 10 MB per-session memory budget and resets the stream whose response arrives while it is exhausted; since undici 8 every envd request of a process shares one session, so parallel or large uploads reset each other and the reads next to them. `files.write()` uploads now go over HTTP/1.1 (one request per pooled connection, no shared budget), and an envd dispatcher whose HTTP/2 session Node reports as out of memory is retired and replaced instead of failing every later request. Nothing is retried: a failed write may already have been applied.
