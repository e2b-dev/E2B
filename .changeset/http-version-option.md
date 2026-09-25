---
'e2b': minor
'@e2b/python-sdk': minor
---

Add an `http_version` (Python) / `httpVersion` (JS) connection option, `"http1"` or `"http2"` (default), also settable with the `E2B_HTTP_VERSION` environment variable, to pin requests to the E2B API and to sandboxes (commands, filesystem, PTY) to HTTP/1.1.
