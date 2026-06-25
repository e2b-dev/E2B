---
"@e2b/cli": minor
---

Replace legacy access token auth with OAuth 2.0 refresh token flow. The CLI now authenticates via a public OAuth client using PKCE, receiving Hydra JWTs that are refreshed automatically. Config schema bumped to v1 with nested `identity`, `oauth`, and `tokens` sections. Old flat configs are deprecated and require re-login.
