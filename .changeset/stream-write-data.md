---
"e2b": minor
"@e2b/python-sdk": minor
---

`files.write` streams iterables of byte chunks to the sandbox instead of buffering them:

- JS: `AsyncIterable<Uint8Array>` data (async generators, Node.js `Readable`), alongside `ReadableStream`.
- Python: `Iterable[bytes]` in `Sandbox`, plus `AsyncIterable[bytes]` in `AsyncSandbox`.

Stream data always uses the octet-stream upload and works with `gzip`.

**Breaking (JS):** `ReadableStream` / `AsyncIterable` data is no longer buffered into a multipart upload: `useOctetStream: false` throws `InvalidArgumentError`, and an envd older than 0.5.7 throws `TemplateError`. Python raises `InvalidArgumentException` / `TemplateException` for iterables in the same cases.

**Breaking (both SDKs):** `gzip: true` with `useOctetStream: false` / `gzip=True, use_octet_stream=False` is now rejected as an invalid combination (`InvalidArgumentError` / `InvalidArgumentException`) instead of gzip silently overriding it.
