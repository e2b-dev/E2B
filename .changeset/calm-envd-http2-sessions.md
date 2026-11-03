---
'e2b': patch
---

Fix `TypeError: fetch failed` with `NGHTTP2_ENHANCE_YOUR_CALM` on concurrent `files.write()` calls. Node's HTTP/2 client queues each buffered request body in full against a 10 MB per-session memory budget and resets whichever stream's response arrives while it is exhausted; since undici 8 every envd REST request of a process shares one session. Buffered `files.write()` uploads are now admitted so that the bodies in flight together stay within 6 MB, an upload larger than that is sent over an HTTP/2 session of its own (so it cannot reset concurrent reads), and a dispatcher whose session Node reports as out of memory is retired and replaced instead of failing every later request.
