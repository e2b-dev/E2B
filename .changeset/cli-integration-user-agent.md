---
"@e2b/cli": patch
---

Identify all CLI traffic to the API by tagging every request with an `e2b-cli/<version>` identifier in the `User-Agent` header, so CLI usage and version distribution can be tracked server-side. Attribution is set once at startup via the SDK's `ConnectionConfig.setIntegration()`, so it applies to every request the CLI makes. No user-facing behavior changes.
