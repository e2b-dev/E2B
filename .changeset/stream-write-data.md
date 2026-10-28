---
"e2b": minor
"@e2b/python-sdk": minor
---

`files.write` streams iterables of byte chunks to the sandbox instead of buffering them:

- JS: `AsyncIterable<Uint8Array>` data (async generators, Node.js `Readable`), alongside `ReadableStream`.
- Python: `Iterable[bytes]` in `Sandbox` and `AsyncIterable[bytes]` in `AsyncSandbox`; each SDK rejects the other's iterable kind with `InvalidArgumentException`.

Stream data always uses the octet-stream upload, works with `gzip`, and is never buffered in memory. In browsers that can't stream a request body (Firefox, Safari and every iOS browser), JS stream data throws `InvalidArgumentError` instead (pass a `Blob`, e.g. `await new Response(stream).blob()`); Chromium-based browsers stream it. A chunk that isn't bytes throws `InvalidArgumentError` / `InvalidArgumentException` rather than a transport error.

Python file-like objects that aren't `io.IOBase` but have a sync `read()` (`tempfile.NamedTemporaryFile()`, werkzeug `FileStorage`, Django `File`) are uploaded as files; objects with an async `read()` (aiofiles, aiohttp `response.content`) are consumed as async iterables by `AsyncSandbox`. `AsyncSandbox.files.write_files` is typed as `Sequence[AsyncWriteEntry]`.

**Breaking (JS):** `ReadableStream` / `AsyncIterable` data is no longer buffered: browsers without streaming request bodies throw, and multipart is refused — `useOctetStream: false` throws `InvalidArgumentError`, and an envd older than 0.5.7 throws `TemplateError`. Python raises `InvalidArgumentException` / `TemplateException` for iterables in the same cases.

**Breaking (both SDKs):** `gzip: true` with `useOctetStream: false` / `gzip=True, use_octet_stream=False` is now rejected as an invalid combination (`InvalidArgumentError` / `InvalidArgumentException`) instead of gzip silently overriding it.
