---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove client-side API key format validation. The SDK no longer checks that the API key matches the `e2b_` hex format — only that a key is present. The `validateApiKey`/`validate_api_key` option is deprecated and has no effect, and the `E2B_VALIDATE_API_KEY` environment variable is no longer read. The server remains the source of truth for key validity.
