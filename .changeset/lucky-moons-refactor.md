---
'e2b': patch
'@e2b/python-sdk': patch
---

Rework the multi-client binding: the `E2B` client now builds its resource classes through a hidden `ClientFactory.withOpts` (JS) / `ClientFactory._with_params` (Python) method that returns a subclass with the connection config bound, instead of inlining subclass creation in the client constructor
