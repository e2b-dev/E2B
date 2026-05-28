---
'@e2b/python-sdk': patch
---

Remove dead code in `ConnectionConfig.__init__` that duplicated the logic of `_get_request_timeout` and immediately overwrote its result. Behavior is unchanged.
