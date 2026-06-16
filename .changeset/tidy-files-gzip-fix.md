---
"e2b": patch
---

Make the `gzip: true` upload option imply the `application/octet-stream` upload path so it is no longer silently ignored on the default `multipart/form-data` path. On envd versions older than 0.5.7 the upload still falls back to uncompressed `multipart/form-data`.
