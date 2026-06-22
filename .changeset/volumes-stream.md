---
"e2b": patch
"@e2b/python-sdk": patch
---

Stream volume file uploads and downloads instead of buffering in memory:

- `Volume.writeFile()` / `Volume.write_file()`: `ReadableStream` data (JS, outside the browser) and file-like objects (Python) are now streamed to the API in chunks.
- `Volume.readFile(format="stream")` / `read_file(format="stream")`: the request timeout now bounds only the initial handshake instead of killing the stream while it's being consumed (Python disables the read timeout; JS bounds the handshake and supports `signal` to cancel an in-flight stream). A dropped connection during the stream handshake now surfaces the same typed, health-checked error as non-stream reads.
