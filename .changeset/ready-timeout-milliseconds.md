---
'e2b': patch
'@e2b/python-sdk': patch
---

Preserve fractional seconds in `waitForTimeout` and `wait_for_timeout` so template readiness waits for the requested duration. Durations below one second still wait for one second.
