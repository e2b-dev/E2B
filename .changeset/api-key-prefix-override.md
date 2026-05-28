---
'e2b': patch
'@e2b/python-sdk': patch
---

Support a custom API key prefix for client-side validation. The prefix defaults to `e2b_` and can be overridden via the `E2B_API_KEY_PREFIX` environment variable or the `apiKeyPrefix` (JS) / `api_key_prefix` (Python) connection option.
