---
'@e2b/cli': patch
---

`e2b template list` now accepts `E2B_API_KEY` as well as `E2B_ACCESS_TOKEN` — the underlying `GET /templates` endpoint supports either credential. `e2b template create` no longer requires `E2B_ACCESS_TOKEN`; the command only calls API-key-authenticated endpoints, so the access-token check was spurious and prevented API-key-only environments from creating templates.
