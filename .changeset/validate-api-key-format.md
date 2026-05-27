---
'e2b': patch
'@e2b/python-sdk': patch
---

Add client-side API key and access token format validation to JS and Python SDKs. Keys and tokens must match the `e2b_` + hex format. Invalid formats produce a clear error message directing users to the dashboard.
