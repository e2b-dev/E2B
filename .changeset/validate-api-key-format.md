---
'e2b': patch
'@e2b/python-sdk': patch
---

Add client-side API key format validation to JS and Python SDKs. When a UUID (key ID) is passed instead of the actual secret key, or when the key doesn't start with the expected `e2b_` prefix, a clear error message is thrown directing users to the dashboard.
