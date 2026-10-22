---
"e2b": minor
"@e2b/python-sdk": minor
---

`files.write` streams iterables of byte chunks to the sandbox instead of buffering them:

- JS: `AsyncIterable<Uint8Array>` data (async generators, Node.js `Readable`), alongside `ReadableStream`.
- Python: `Iterable[bytes]` in `Sandbox`, plus `AsyncIterable[bytes]` in `AsyncSandbox`.

Like file-like data, they default to the octet-stream upload and work with `gzip`; the multipart fallback buffers them.
