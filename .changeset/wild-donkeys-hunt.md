---
'@e2b/code-interpreter-python': patch
---

Abort Jupyter requests at the deadline they were given instead of twice it. The SDK's pyqwest-backed transport derives a single whole-request deadline by summing httpx's `read` and `write` phases, and every request set both to the requested timeout — so `run_code(timeout=1)` ran for up to 2 seconds, and the context requests (`request_timeout`) likewise bought twice their value.
