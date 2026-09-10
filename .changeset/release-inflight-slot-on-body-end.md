---
'e2b': patch
---

Hold the in-flight concurrency slot (`limitConcurrency`) until the response body ends — fully consumed, cancelled, or errored — instead of releasing it as soon as the headers arrive. Streaming responses (logs, command output) now count against the cap for their whole lifetime, so the SDK-level limit matches the dispatcher's connection accounting and no longer overshoots into `ERR_HTTP2_TOO_MANY_CONCURRENT_STREAMS`.

Responses that carry no bytes — null-body statuses (e.g. `204`), `Content-Length: 0`, `HEAD`, or a body a mock/interceptor already read or locked — release the slot immediately.

On the envd RPC fetcher, one slot is reserved for short unary/control calls (`commands.kill`, `sendStdin`, `list`, `pty.*`), so long-lived Connect streams (background commands, PTYs, `watchDir`) can never wedge the calls that end them. A request aborted while still queued for a slot now names the `E2B_*_INFLIGHT_REQUESTS` env var that configured the cap instead of pointing at `requestTimeoutMs`.
