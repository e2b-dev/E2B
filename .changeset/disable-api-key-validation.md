---
'e2b': patch
'@e2b/python-sdk': patch
---

Allow disabling client-side API key format validation. Set the `E2B_VALIDATE_API_KEY` environment variable to `false`, or pass the `validateApiKey: false` (JS) / `validate_api_key=False` (Python) connection option, when your deployment issues API keys that don't match the default `e2b_` format.
