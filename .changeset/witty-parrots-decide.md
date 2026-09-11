---
'e2b': patch
'@e2b/python-sdk': patch
---

Remove client-side validation of the fork `count` argument. The API validates the requested fork count and rejects invalid values.
