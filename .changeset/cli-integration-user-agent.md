---
"@e2b/cli": patch
---

Identify CLI traffic to the API by setting the `integration` field on the CLI's `ConnectionConfig`. Every request the CLI makes now carries `e2b-cli/<version>` in the `User-Agent` header, so CLI usage and version distribution can be tracked server-side. No user-facing behavior changes.
