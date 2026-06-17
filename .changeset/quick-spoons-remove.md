---
"@e2b/python-sdk": minor
"e2b": minor
"@e2b/cli": patch
---

Remove access-token auth from the SDKs; it was only ever used by the CLI, never by an SDK operation.

- Removed the unused auth toggles from the API clients: `requireAccessToken` (JS) / `require_access_token` (Python), and `requireApiKey` (JS) / `require_api_key` (Python). No caller set these to a non-default value, so behavior is unchanged — the API key is still required for all SDK operations.
- **Breaking:** removed the `accessToken` (JS) / `access_token` (Python) option from `ConnectionConfig`, along with the SDK-level `E2B_ACCESS_TOKEN` environment variable lookup. No SDK method (sandbox, template, or volume) used it — those authenticate with the API key. If you need to send a custom `Authorization` header, pass it via `apiHeaders` instead, e.g. `new ConnectionConfig({ apiHeaders: { Authorization: 'Bearer <token>' } })`.

The CLI continues to authenticate against the `/teams` endpoint with the access token, now passed through `apiHeaders` instead of the dedicated option.
