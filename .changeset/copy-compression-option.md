---
"e2b": minor
"@e2b/python-sdk": minor
---

Add a `compression` (`compression` in Python) option to the template
`copy` layer to control whether copied files are gzipped before upload.

Compression is enabled by default (matching the previous behavior). Pass
`compression: false` (`compression=False` in Python) to upload an
uncompressed tar archive instead — useful when copying already-compressed
files where gzipping adds CPU cost without shrinking the payload.

```ts
// JS/TS
template.copy('model.bin', '/app/', { compression: false })
```

```python
# Python
template.copy('model.bin', '/app/', compression=False)
```
