---
'@e2b/cli': minor
---

`e2b template list` and `e2b template create` now authenticate with `E2B_API_KEY` instead of requiring `E2B_ACCESS_TOKEN`. `E2B_ACCESS_TOKEN` is deprecated, so commands whose endpoints accept either credential now use the API key. This also unblocks API-key-only environments (e.g. CI/CD) that previously could not create or list templates.
