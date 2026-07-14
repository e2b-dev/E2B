---
'@e2b/cli': patch
---

Attribute CLI traffic by tagging the `User-Agent` header of every request with `e2b-cli/<version>` and the invoked command as `e2b-cli-command/<command>` (e.g. `e2b-cli-command/sandbox.list`) via `ConnectionConfig.setIntegration`
