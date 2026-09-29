---
'@e2b/python-sdk': patch
'e2b': patch
---

Keep sending the documented 5-minute timeout when `Sandbox.fork()` / `fork()` is called without one. Sandbox create and connect moved to the v2 endpoints, which default an omitted timeout to 300 seconds, but fork has no v2 route and its own default is 15 seconds — so since 2.51.0 forks created without an explicit timeout expired (or auto-paused, when the sandbox was configured that way) about fifteen seconds after they started. An explicit `timeoutMs` / `timeout` is still sent unchanged.
