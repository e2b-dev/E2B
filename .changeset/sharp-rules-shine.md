---
"@e2b/python-sdk": patch
---

Map transport-level timeouts from `httpcore` (e.g. a stream read timeout) to `TimeoutException`. When iterating over a long-running command's output, the underlying HTTP read timeout (set to the command `timeout`) races with the server's own `deadline_exceeded` response; whichever fires first won, so the client could leak a raw `httpcore.ReadTimeout` instead of a `TimeoutException`. Both cases now surface a consistent, actionable `TimeoutException`.
