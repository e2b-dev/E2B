---
"@e2b/python-sdk": minor
---

Move template build-context uploads (to S3 presigned URLs) onto
[`pyqwest`](https://pypi.org/project/pyqwest/) via its httpx-compatible
transport adapter. Content-Length framing for the streamed archive body is
preserved (S3 rejects chunked transfer encoding). The 1-hour upload timeout
now bounds the entire upload rather than each socket operation, and
`verify_ssl=False` on the client is no longer honored for uploads (pyqwest
has no insecure-TLS option).
