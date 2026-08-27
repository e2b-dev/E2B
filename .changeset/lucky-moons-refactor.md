---
'e2b': patch
'@e2b/python-sdk': patch
---

Rework the multi-client binding: the resource classes (`Sandbox`, `Volume`, `Template`, `Secret`, and the async Python variants) gain a public `withOptions(opts)` (JS) / `with_params(**params)` (Python) static/classmethod that returns a copy of the class with the connection config bound, merging with any config already bound to it. The `E2B` client builds its resources through these
