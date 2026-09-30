---
'@e2b/cli': minor
'e2b': minor
'@e2b/python-sdk': minor
---

Fork sandboxes through `POST /v2/sandboxes/{sandboxID}/fork`. An omitted timeout now defaults to the API's v2 sandbox timeout (300 seconds) instead of 15 seconds. The fork count is no longer capped client-side: `e2b sandbox fork --count`, JavaScript `Sandbox.fork({ count })`, and Python `Sandbox.fork(count=...)` send any count and the API enforces the per-team limit.
