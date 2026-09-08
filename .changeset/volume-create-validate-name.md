---
'e2b': patch
'@e2b/python-sdk': patch
---

Reject volume names outside `^[a-zA-Z0-9_-]+$` in `Volume.create` before constructing the API client.
