---
"e2b": patch
"@e2b/python-sdk": patch
---

Stream uploads instead of buffering streaming input entirely in memory:

- `Sandbox.files.write()` / `write_files()`: `ReadableStream` data (JS, outside the browser) and file-like objects (Python) are streamed to the sandbox, including when `gzip` is enabled (compression now happens chunk by chunk). `useOctetStream`/`use_octet_stream` now defaults to auto-detect — octet-stream is used when any entry is streamable (so streamed uploads aren't silently buffered) and `multipart/form-data` otherwise; browsers always use `multipart/form-data`. Streamed uploads also use a longer transfer timeout instead of the default request timeout, so large uploads aren't cut off.
- `Sandbox.files.read(format="stream")`: the request timeout now bounds only the initial handshake instead of killing the stream while it's being consumed (Python disables the read timeout; JS bounds the handshake and supports `signal` to cancel an in-flight stream). A dropped connection during the stream handshake now surfaces the same typed, health-checked error as non-stream reads.
- Python `Sandbox.files.read(format="stream")`: the response body is now streamed from the sandbox instead of being downloaded into memory before iteration (sync and async).
- JS `Sandbox.files.read()` with `blob` or `stream` format now returns an empty `Blob`/`ReadableStream` for empty files instead of `""`.
