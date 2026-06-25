---
"e2b": minor
"@e2b/python-sdk": minor
---

Add a `gzip` option to the template `copy` layer to control whether copied
files are gzipped before upload.

Gzip is enabled by default (matching the previous behavior). Pass
`gzip: false` (`gzip=False` in Python) to upload an uncompressed tar archive
instead — useful when copying already-compressed files where gzipping adds
CPU cost without shrinking the payload.

```ts
// JS/TS
template.copy('model.bin', '/app/', { gzip: false })
```

```python
# Python
template.copy('model.bin', '/app/', gzip=False)
```
