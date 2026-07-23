---
'e2b': patch
---

Fix template build error stack traces under Bun and template file uploads under Deno.

- `remove`, `rename`, `makeDir`, `makeSymlink`, `pipInstall`, `npmInstall`, `bunInstall`, `aptInstall`, `addMcpServer`, `gitClone`, `betaDevContainerPrebuild`, and `betaSetDevContainerStart` now capture the caller stack trace in the method body itself. Bun's JavaScriptCore engine elides tail-call frames, which previously made build errors from these methods point at the wrong stack frame when running under Bun.
- `Template.build` file uploads now send the spooled archive as a file-backed `Blob` (falling back to the blob's stream with an explicit `Content-Length` under Bun, whose blobs carry an inferred MIME type that would break presigned-URL signatures). Deno's `fetch` ignores a `Content-Length` header on stream bodies and fell back to `Transfer-Encoding: chunked`, which S3-compatible presigned upload URLs reject (see #1243).
