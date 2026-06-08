---
"@e2b/cli": patch
---

Remove `ensureAccessToken` call from `e2b template create`: the command now relies solely on the API key for authentication.
