---
'e2b': patch
'@e2b/python-sdk': patch
---

Rework the multi-client binding: the `E2B` client now builds its resource classes through the exported `bindClientOpts(cls, opts)` (JS) / `bind_client_params(cls, **params)` (Python) helpers, which return a subclass with the connection config bound, merging with any config already bound to the class
