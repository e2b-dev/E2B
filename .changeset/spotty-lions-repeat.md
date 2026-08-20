---
'e2b': patch
'@e2b/python-sdk': patch
---

Only build errors carry user-code stack traces; validation, API, and file upload errors now use ordinary stacks from where they are thrown
