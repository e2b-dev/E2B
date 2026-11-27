---
'e2b': patch
'@e2b/python-sdk': patch
---

`files.read` now always requests gzip-encoded downloads (`Accept-Encoding: gzip`), including in runtimes whose `fetch` doesn't negotiate compression by default, like Cloudflare Workers. The `gzip` option of `files.read` is deprecated: it no longer has an effect and will be removed in the next major version.
