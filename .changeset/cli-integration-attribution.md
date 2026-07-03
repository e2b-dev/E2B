---
'@e2b/cli': patch
---

Attribute CLI traffic by tagging the `User-Agent` header of every request with `e2b-cli/<version>` via `ConnectionConfig.setIntegration`
