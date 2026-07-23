---
'e2b': patch
---

Fix template file uploads under Deno. `Template.build` uploads now send the spooled archive as a file-backed `Blob` (falling back to the blob's stream with an explicit `Content-Length` on runtimes like Bun whose blobs carry an inferred MIME type that would break presigned-URL signatures). Deno's `fetch` ignores a `Content-Length` header on stream bodies and fell back to `Transfer-Encoding: chunked`, which S3-compatible presigned upload URLs reject (see #1243).
