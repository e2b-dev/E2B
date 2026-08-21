---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove client-side API key format validation. The SDK no longer checks that API keys match the `e2b_` + hex format before sending requests — the API is the source of truth for key validity. The `validateApiKey`/`validate_api_key` option and the `E2B_VALIDATE_API_KEY` environment variable are removed.
