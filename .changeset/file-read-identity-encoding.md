---
'@e2b/python-sdk': patch
'e2b': patch
---

`files.read` now sends `Accept-Encoding: identity` unless `gzip` is set, avoiding `too_many_data_frames` errors on large Python file reads over HTTP/2
