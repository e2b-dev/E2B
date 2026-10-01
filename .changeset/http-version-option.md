---
'e2b': minor
'@e2b/python-sdk': minor
---

Add an `http_version` (Python) / `httpVersion` (JS) connection option, `"1.1"` or `"2"` (default), also settable with the `E2B_HTTP_VERSION` environment variable, to pin requests to the E2B API, to sandboxes (commands, filesystem, PTY) and to volume content to HTTP/1.1. It can also be bound once on a client: `E2B(http_version="1.1")` / `new E2B({ httpVersion: '1.1' })`.
