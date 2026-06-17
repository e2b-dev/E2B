---
"@e2b/python-sdk": patch
"e2b": patch
"@e2b/cli": patch
---

Tidy up SDK authentication and deprecate the access token in `ConnectionConfig`.

- Deprecated the `accessToken` (JS) / `access_token` (Python) option on `ConnectionConfig`. It still works exactly as before — when set (or via `E2B_ACCESS_TOKEN`), the `Authorization: Bearer` header is still sent — but you should pass custom auth through `apiHeaders` instead, e.g. `new ConnectionConfig({ apiHeaders: { Authorization: 'Bearer <token>' } })`.
- Removed the unused auth toggles from the API clients: `requireAccessToken`/`requireApiKey` (JS) and `require_access_token`/`require_api_key` (Python). No caller ever set them to a non-default value, so behavior is unchanged.
- The CLI now passes the access token to the `/teams` endpoint through `apiHeaders` instead of the deprecated option.
- Decoupled the sandbox-scoped envd access token from `ConnectionConfig`: `EnvdApiClient` now owns its own `accessToken` field and sets the `X-Access-Token` header itself.
