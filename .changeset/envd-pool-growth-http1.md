---
'e2b': minor
'@e2b/python-sdk': minor
---

Add a `sandbox_http2` (Python) / `sandboxHttp2` (JS) connection option, also settable with the `E2B_SANDBOX_HTTP2` environment variable, to pin sandbox traffic (commands, filesystem, PTY) to HTTP/1.1. Requests to the E2B API are unaffected.

The Python SDK now spreads sandbox traffic across HTTP/2 connection pools by load instead of hashing each sandbox to one of four fixed pools: every request goes to the pool with the fewest requests in flight, and a further pool is opened only once every open pool carries `E2B_ENVD_POOL_STREAMS` (default 90) requests — below the 100 concurrent streams the sandbox host allows per connection — up to `E2B_ENVD_POOL_SHARDS` (default raised from 4 to 16) pools. A process running a single sandbox keeps one connection; one with hundreds of long-running commands is no longer queued behind a saturated connection, whether they belong to many sandboxes or to a few.
