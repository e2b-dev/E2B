---
'e2b': patch
'@e2b/python-sdk': patch
---

Template builds hash `copy()` files in 1 MB chunks instead of reading each file fully into memory, cutting peak memory for large files. Hashes are unchanged, so existing build caches stay valid.
