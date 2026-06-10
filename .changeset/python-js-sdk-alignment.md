---
"e2b": patch
"@e2b/python-sdk": patch
"@e2b/cli": patch
---

fix: align behavior between the JS and Python SDKs

Python SDK:

- `commands.send_stdin` and `CommandHandle.send_stdin` now accept `bytes` in addition to `str`, and the handle's `send_stdin` / `close_stdin` now accept a `request_timeout`.
- `git.reset` now accepts a typed `GitResetMode` and its validation error matches the JS SDK wording/ordering. `GitResetMode` is now exported.
- `sandbox_url` is now propagated through `get_api_params`.
- `Template.from_image()` now raises when only one of `username` / `password` is provided.
- `get_info()` no longer carries the envd access token on the returned `SandboxInfo` (the `_envd_access_token` field was unused), matching the JS SDK which strips it from `getInfo`.
- `get_metrics()` now raises `TemplateException` (was `SandboxException`) with the same message as the JS SDK when the sandbox is too old.

JS SDK:

- `Sandbox.getInfo()` now includes `sandboxDomain`, matching the Python SDK's single `get_info`. `getFullInfo` is deprecated and now just wraps `getInfo` (it no longer returns the envd access token).
- `Sandbox.getMetrics()` now returns `[]` in debug mode, matching the Python SDK. The debug short-circuit for `getMetrics` / `kill` is implemented on both the instance and static methods, so it applies consistently whether called as `Sandbox.kill(sandboxId)` or `sandbox.kill()`.
- `Template.fromImage()` now requires both `username` and `password` when registry credentials are provided.
- `Template.getBuildStatus()` now defaults `logsOffset` to `0`.
- `requestTimeoutMs: 0` now explicitly disables the request timeout.
- `getMetrics()` now throws `TemplateError` (was `SandboxError`) when the sandbox is too old to support metrics.
