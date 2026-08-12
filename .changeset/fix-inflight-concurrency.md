---
"e2b": patch
---

fix(js-sdk): enforce inflight concurrency cap on streaming bodies

Defer the release of the inflight semaphore until the `Response.body` is fully consumed, aborted, or errors out. This prevents HTTP/2 stream exhaustion under heavy load.
