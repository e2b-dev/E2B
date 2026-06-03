---
"@e2b/cli": patch
---

Restrict `~/.e2b/config.json` permissions to owner-only (`0600`) and create `~/.e2b` as `0700`, preventing other local users from reading the stored access token and team API key
