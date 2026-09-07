---
'e2b': patch
'@e2b/python-sdk': patch
---

Reject unusable secret names in `Secret.create` with `InvalidArgumentError` / `InvalidArgumentException` before constructing the API client, matching `Secret.fill`.
