---
"@e2b/python-sdk": patch
"@e2b/code-interpreter-python": patch
---

Enforce `request_timeout` (and other request timeouts such as `run_code(timeout=...)` and template upload timeouts) as a whole-request deadline. pyqwest's httpx adapter sums the httpx `read` and `write` phases, so a timeout of `N` seconds was enforced after `~2N` seconds; the SDK's shared transports now map the deadline once in `e2b.deadline`, and the retry layer budgets against the same deadline. `request_timeout=0` on `run_code` and `create_code_context` now disables the request timeout instead of falling back to the configured default.
