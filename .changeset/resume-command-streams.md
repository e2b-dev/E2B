---
'e2b': minor
'@e2b/python-sdk': minor
---

Command and PTY output streams now survive dropped connections. The SDK tracks how far into each output stream it has delivered and, when the connection to envd drops, reconnects with `resume_from` so envd replays the output produced in the meantime — no chunks are lost or duplicated, and `wait()` still returns the full result. Sandboxes running an envd that does not retain output keep the previous behavior. When the output produced while disconnected is no longer retained, the handle raises `CommandOutputLostError` (JS) / `CommandOutputLostException` (Python) instead of silently skipping it.
