---
'@e2b/code-interpreter-python': patch
---

`run_code(..., timeout=N)` now times out after N seconds instead of 2N, and `create_code_context` / `remove_code_context` / `list_code_contexts` / `restart_code_context` honor `request_timeout` exactly. Requires `e2b>=2.65.0`, which ships the transport fix.
