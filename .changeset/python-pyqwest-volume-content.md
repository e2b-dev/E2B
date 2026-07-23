---
"@e2b/python-sdk": minor
---

Move the volume content client (`Volume`/`AsyncVolume` file operations) onto
[`pyqwest`](https://pypi.org/project/pyqwest/) via its httpx-compatible
transport adapter, the same stack the REST API client uses. The connection
pool is shared process-wide per proxy instead of one pool per thread (sync)
or per event loop (async), and connection-establishment failures are retried
with backoff (`E2B_CONNECTION_RETRIES`, default 3), as before.

For streamed volume reads (`Volume.read_file(format="stream")`), a stalled
stream is by default bounded by a transport-wide idle read timeout of
60 seconds that resets on every chunk (still surfaced as
`httpx.ReadTimeout`; matches the JS SDK's default stream idle timeout).
`AsyncVolume.read_file` keeps honoring an explicit `stream_idle_timeout`
per read (including `0` to disable); the sync client ignores it — it cannot
interrupt a blocking read. Passing `request_timeout` to a streamed read now
bounds the whole transfer rather than individual socket operations.
