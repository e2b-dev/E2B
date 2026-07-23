---
'e2b': patch
---

Fix template file uploads under Deno. Deno's native `fetch` ignores a `Content-Length` header on stream bodies and fell back to `Transfer-Encoding: chunked`, which S3-compatible presigned upload URLs reject (see #1243). `Template.build` uploads now stream the spooled archive through undici's `fetch`, which honors the header on every runtime, falling back to the global `fetch` where undici isn't resolvable.
