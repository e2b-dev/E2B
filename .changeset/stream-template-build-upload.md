---
"e2b": patch
"@e2b/python-sdk": patch
---

Template builds: the build-context tar archive is now spooled to a temporary file and streamed from disk during upload instead of being held in memory (JS and Python, sync and async), while keeping the explicit `Content-Length` required by S3 presigned URLs.
