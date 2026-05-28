---
'@e2b/cli': patch
---

`e2b template list` now accepts `E2B_API_KEY` as well as `E2B_ACCESS_TOKEN`. The underlying `GET /templates` endpoint already supports either credential, so the CLI no longer forces an access token when an API key is available.
