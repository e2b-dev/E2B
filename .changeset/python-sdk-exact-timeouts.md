---
'@e2b/python-sdk': patch
---

Fix HTTP timeouts taking twice as long as configured. pyqwest's httpx adapter turned httpx's per-phase timeouts into one request deadline of `read + write`, so every timeout on the SDK's HTTP clients (control-plane calls, `is_running`, envd health checks, `files.read` / `files.write`, volume and template uploads) waited twice the configured value. The deadline is now exactly the configured value. Calls that only succeeded thanks to the extra time now time out at the configured value; raise `request_timeout` (or pass `0` to disable it) if you need more.
