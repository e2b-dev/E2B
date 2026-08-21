---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove client-side API key format validation. The SDK no longer checks that the API key matches the `e2b_` hex format — only that a key is present — so the `validateApiKey`/`validate_api_key` option and the `E2B_VALIDATE_API_KEY` environment variable are gone. The server remains the source of truth for key validity.
