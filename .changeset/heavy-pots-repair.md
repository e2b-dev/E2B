---
"e2b": patch
---

Fix `Volume.readFile` returning `undefined` instead of an empty `Blob`/`ReadableStream` for empty files, and apply the documented 60s default request timeout to volume content requests.
