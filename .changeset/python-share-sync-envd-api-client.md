---
"@e2b/python-sdk": patch
---

Build the envd HTTP API client once per sync `Sandbox` and share it across the
filesystem, commands, and PTY modules, which now receive it instead of each
constructing their own — matching `AsyncSandbox`. No behavior change: the
pyqwest transport underneath is already cached process-wide per
`(proxy, for_streaming)`, so the separate clients shared one connection pool
either way. `Filesystem` still builds the streaming sibling client whose
transport carries the idle read timeout, in both flavors.
