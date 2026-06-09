---
"e2b": patch
"@e2b/python-sdk": patch
"@e2b/cli": patch
---

fix: align behavior between the JS and Python SDKs

Python SDK:

- `Sandbox.pause()` / `beta_pause()` now return a `bool` (`True` if the sandbox was paused, `False` if it was already paused), matching the JS SDK.
- `get_metrics` no longer silently returns `[]` in debug mode, matching the JS SDK.
- `Sandbox.kill()` debug-mode handling now matches the JS SDK: only the instance method short-circuits in debug, not the class method.
- `commands.send_stdin` and `CommandHandle.send_stdin` now accept `bytes` in addition to `str`, and the handle's `send_stdin` / `close_stdin` now accept a `request_timeout`.
- `git.reset` now accepts a typed `GitResetMode` and its validation error matches the JS SDK wording/ordering. `GitResetMode` is now exported.
- `sandbox_url` is now propagated through `get_api_params`.
- `Template.from_image()` now raises when only one of `username` / `password` is provided.

JS SDK:

- `Sandbox.getInfo()` now includes `sandboxDomain`; `getFullInfo` is now internal.
- `Template.fromImage()` now requires both `username` and `password` when registry credentials are provided.
- `Template.getBuildStatus()` now defaults `logsOffset` to `0`.
- `requestTimeoutMs: 0` now explicitly disables the request timeout.
