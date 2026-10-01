---
'@e2b/cli': minor
'e2b': minor
'@e2b/python-sdk': minor
---

Fork sandboxes through `POST /v2/sandboxes/{sandboxID}/fork`. An omitted timeout now defaults to the API's v2 sandbox timeout (300 seconds) instead of 15 seconds. The fork count is no longer capped client-side: `e2b sandbox fork --count`, JavaScript `Sandbox.fork({ count })`, and Python `Sandbox.fork(count=...)` send any count and the API enforces the per-team limit.

Forks can skip the memory snapshot: JavaScript `Sandbox.fork({ keepMemory: false })` and Python `Sandbox.fork(keep_memory=False)` capture only the filesystem, so the forks cold-boot from disk while the source sandbox keeps running.
