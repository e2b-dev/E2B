---
"@e2b/cli": patch
---

Identify all CLI traffic to the API by tagging every request with an `e2b-cli/<version>` identifier in the `User-Agent` header, so CLI usage and version distribution can be tracked server-side. The integration is threaded through every CLI call site — the shared API client plus the auth, sandbox lifecycle (`create`/`connect`/`resume`/`kill`/`pause`/`list`/`info`/`metrics`/`exec`), and `template build` commands that construct their own connection. No new dependencies and no user-facing behavior changes.
