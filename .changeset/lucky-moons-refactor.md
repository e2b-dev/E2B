---
'e2b': patch
'@e2b/python-sdk': patch
---

Rework the multi-client binding: the `E2B` client now builds its resource classes through `ClientFactory.bindClientOpts` (JS) / `ClientFactory.bind_client_params` (Python), which returns a subclass with the connection config bound, merging with any config already bound to the class
