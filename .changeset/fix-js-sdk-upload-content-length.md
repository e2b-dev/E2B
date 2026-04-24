---
"e2b": patch
---

fix(js-sdk): buffer template tar archive before upload so `fetch` sets `Content-Length` instead of falling back to `Transfer-Encoding: chunked`. S3 presigned PUT URLs reject chunked requests with `501 NotImplemented`, breaking template uploads in self-hosted deployments backed by S3-compatible storage. Aligns the JS SDK with the Python SDK, which already buffers via `io.BytesIO`.
