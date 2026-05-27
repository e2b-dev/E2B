---
'e2b': minor
'@e2b/python-sdk': minor
---

Sync OpenAPI spec from `e2b-dev/infra`. Notable changes: `SandboxMetrics` gains `memCache` / `mem_cache` (cached memory in bytes), `NodeStatus` gains `standby`, `TeamUser.email` is now nullable and deprecated, and `POST /v3/templates` can now return `403`.
