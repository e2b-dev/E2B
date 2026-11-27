---
'@e2b/code-interpreter-python': patch
---

fix(code-interpreter): enforce `run_code(timeout=...)` at the requested deadline — the timeout was built as `httpx.Timeout(timeout, connect=request_timeout)`, which sets read = write = timeout, and the pyqwest transport derives its whole-request deadline by summing read + write, so every execution was capped at `2 * timeout` (`timeout=1` aborted after ~2s). The timeout is now built so read + write sums to the requested budget, and the context requests no longer double their `request_timeout` either.
