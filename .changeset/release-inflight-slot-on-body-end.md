---
'e2b': patch
---

Hold the in-flight concurrency slot (`limitConcurrency`) until the response body ends — fully consumed, cancelled, or errored — instead of releasing it as soon as the headers arrive. Streaming responses (logs, command output) now count against the cap for their whole lifetime, so the SDK-level limit matches the dispatcher's connection accounting and no longer overshoots into `ERR_HTTP2_TOO_MANY_CONCURRENT_STREAMS`. Bodiless responses (e.g. `204`) release the slot immediately.
