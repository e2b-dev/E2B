---
"@e2b/python-sdk": minor
---

Move the envd HTTP API client (sandbox file transfers, health checks) onto
[`pyqwest`](https://pypi.org/project/pyqwest/) via its httpx-compatible
transport adapter. envd RPC already runs on pyqwest through `connectrpc`, so
all sandbox traffic now shares one HTTP stack built from the same transport
pieces (with separate connection pools per use).

The per-thread (sync) and per-loop (async) envd httpx clients are gone: the
pyqwest transports are thread-safe and loop-independent, so a single client
per module serves all threads and event loops.

Timeout semantics through the adapter:

- Streamed downloads (`files.read(format="stream")`): a `request_timeout`
  set explicitly for the call is the deadline for the whole transfer — by
  default the transfer is unbounded in total, as before. A stalled stream is
  reclaimed by a 60-second idle read timeout that resets on every chunk.
  `stream_idle_timeout` keeps working on the async client (applied per
  read); the sync client cannot interrupt a blocking read, so it relies on
  the transport-wide idle bound and now ignores the parameter.
- Uploads: a buffered upload is bounded by `request_timeout` as a
  whole-request deadline, and a streamed (file-like) upload carries no
  client-side timeout (a stalled one is bounded server-side by envd's idle
  read timeout) — both matching the JS SDK.
- Non-streamed reads (`files.read()` as text or bytes) and buffered uploads
  are bounded by `request_timeout` for the **whole transfer** (default
  60 seconds), where the previous transport bounded each socket operation
  and left total duration unbounded. Reading or writing a file too large to
  transfer inside the deadline now raises `httpx.ReadTimeout` — pass a
  larger `request_timeout` (or `0` to disable), or use
  `format="stream"`/file-like data, for large transfers.

`E2B_MAX_CONNECTIONS` is no longer read: it configured httpx's global
connection cap, and the last transport that took one is gone (reqwest has no
counterpart — it does not cap concurrent connections). `E2B_KEEPALIVE_EXPIRY`
and `E2B_MAX_KEEPALIVE_CONNECTIONS` keep tuning the pools.
