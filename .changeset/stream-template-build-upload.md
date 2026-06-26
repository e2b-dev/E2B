---
"e2b": patch
"@e2b/python-sdk": patch
---

Template builds: the build-context tar archive is now spooled to a temporary file and streamed from disk during upload instead of being held in memory (JS and Python, sync and async), while keeping the explicit `Content-Length` required by S3 presigned URLs. Temp-file cleanup is now best-effort, so a cleanup failure after the upload no longer masks a successful upload as an error (nor overwrites the real upload error on failure). The Python SDK now uploads the archive with a 1-hour default timeout (overridable via `request_timeout`) instead of the 60s general API timeout, matching the JS SDK and preventing large uploads from timing out.
