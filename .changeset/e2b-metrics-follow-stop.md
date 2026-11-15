---
"@e2b/cli": patch
---

Fix `e2b sandbox metrics --follow` never stopping when the sandbox is paused or closed. It checked the sandbox running state only once before the loop and reused that stale result every iteration; it now re-checks the state each iteration so the stream ends once the sandbox is no longer running.
