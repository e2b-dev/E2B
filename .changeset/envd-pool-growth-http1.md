---
'e2b': minor
'@e2b/python-sdk': minor
---

Add an `http_version` (Python) / `httpVersion` (JS) connection option, `"http1"` or `"http2"` (default), also settable with the `E2B_HTTP_VERSION` environment variable, to pin requests to the E2B API and to sandboxes (commands, filesystem, PTY) to HTTP/1.1.

The Python SDK now spreads sandbox traffic across HTTP/2 connection pools by load instead of hashing each sandbox to one of four fixed pools: every request goes to the pool with the fewest requests in flight, and a further pool is opened only once every open pool carries `E2B_ENVD_POOL_STREAMS` (default 90) requests — below the 100 concurrent streams the sandbox host allows per connection — up to `E2B_ENVD_POOL_SHARDS` (default raised from 4 to 16) pools. A process running a single sandbox keeps one connection; one with hundreds of long-running commands is no longer queued behind a saturated connection, whether they belong to many sandboxes or to a few.
