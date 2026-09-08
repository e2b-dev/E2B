---
'e2b': patch
'@e2b/python-sdk': patch
---

`onTimeout` / `on_timeout` and `onResume` / `on_resume` now raise `InvalidArgumentError` / `InvalidArgumentException` for a value outside their two literals, instead of silently resolving it to the other one. Both are resolved into a boolean before the request is built, so the value never reaches the API and a typo cannot be rejected server-side: `on_timeout="Pause"` previously resolved to `kill` and deleted the sandbox and its snapshot at timeout, and `on_resume="Reboot"` previously restored the memory the caller asked to skip. A nullish value still means "not configured" and leaves the choice to the API.
