---
"e2b": patch
"@e2b/python-sdk": patch
---

Stream uploads instead of buffering streaming input entirely in memory:

- `Volume.writeFile()` / `Volume.write_file()`: `ReadableStream` data (JS, outside the browser) and file-like objects (Python) are now streamed to the API in chunks.
- `Sandbox.files.write()` / `write_files()` with `useOctetStream`/`use_octet_stream`: `ReadableStream` data (JS, outside the browser) and file-like objects (Python) are streamed to the sandbox, including when `gzip` is enabled (compression now happens chunk by chunk).
- Python `Sandbox.files.read(format="stream")`: the response body is now streamed from the sandbox instead of being downloaded into memory before iteration (sync and async).
- JS `Sandbox.files.read({ format: 'stream' })`: the request timeout now bounds only the initial handshake instead of killing the stream while it's being consumed; pass `signal` to cancel an in-flight stream.
- JS `Sandbox.files.read()` with `blob` or `stream` format now returns an empty `Blob`/`ReadableStream` for empty files instead of `""`.
