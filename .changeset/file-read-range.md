---
'e2b': minor
'@e2b/python-sdk': minor
---

feat(sdks): support reading a byte range from `files.read` via `start` / `end` options (HTTP `Range`-style, inclusive end). When set, the SDKs add a `Range: bytes=<start>-<end>` header to `GET /files`, which envd already serves via `http.ServeContent`. Negative values and inverted ranges raise `InvalidArgumentError` / `InvalidArgumentException`.
