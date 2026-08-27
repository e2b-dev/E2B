---
'e2b': patch
'@e2b/python-sdk': patch
---

Rework the multi-client binding: the `E2B` client now builds its resource classes through internal `bindClientOpts(cls, opts)` (JS) / `bind_client_params(cls, **params)` (Python) helpers, and gains `client.withOptions(opts)` (JS) / `client.with_params(**params)` (Python), which return a new client with the options merged over the current client's options
