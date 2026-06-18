---
"@e2b/python-sdk": patch
"e2b": patch
"@e2b/cli": patch
---

Tidy up SDK authentication and deprecate the access token in `ConnectionConfig`.

- Deprecated the `accessToken` (JS) / `access_token` (Python) option on `ConnectionConfig`. It still works exactly as before — when set (or via `E2B_ACCESS_TOKEN`), the `Authorization: Bearer` header is still sent — but you should pass custom auth through `apiHeaders` instead, e.g. `new ConnectionConfig({ apiHeaders: { Authorization: 'Bearer <token>' } })`.
- The SDK now raises a clear error when no API key is supplied, pointing to the API Keys tab (`https://e2b.dev/dashboard?tab=keys`). In JS this is controlled by a `requireApiKey` option (default `true`) so callers that authenticate differently — like the CLI hitting `/teams` with an access token — can opt out; in Python the API key is always required.
- Removed the unused access-token toggle from the API clients: `requireAccessToken` (JS) and `require_access_token` (Python). No caller ever set it to a non-default value, so behavior is unchanged.
- The CLI now passes the access token to the `/teams` endpoint through `apiHeaders` instead of the deprecated option.
- Decoupled the sandbox-scoped envd access token from `ConnectionConfig`: `EnvdApiClient` now owns its own `accessToken` field and sets the `X-Access-Token` header itself.
