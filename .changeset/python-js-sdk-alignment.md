---
"e2b": patch
"@e2b/python-sdk": patch
"@e2b/cli": patch
---

fix: align behavior between the JS and Python SDKs

Python SDK:

- `get_metrics` / `kill` debug-mode handling now lives in the instance method rather than the class method, so `Sandbox.get_metrics(sandbox_id, ...)` / `Sandbox.kill(sandbox_id, ...)` no longer short-circuit in debug.
- `commands.send_stdin` and `CommandHandle.send_stdin` now accept `bytes` in addition to `str`, and the handle's `send_stdin` / `close_stdin` now accept a `request_timeout`.
- `git.reset` now accepts a typed `GitResetMode` and its validation error matches the JS SDK wording/ordering. `GitResetMode` is now exported.
- `sandbox_url` is now propagated through `get_api_params`.
- `Template.from_image()` now raises when only one of `username` / `password` is provided.

JS SDK:

- `Sandbox.getInfo()` now includes `sandboxDomain`; the `getFullInfo` method was removed (use `getInfo`), matching the Python SDK's single `get_info`.
- `Sandbox.getMetrics()` now returns `[]` in debug mode, matching the Python SDK.
- `Template.fromImage()` now requires both `username` and `password` when registry credentials are provided.
- `Template.getBuildStatus()` now defaults `logsOffset` to `0`.
- `requestTimeoutMs: 0` now explicitly disables the request timeout.
