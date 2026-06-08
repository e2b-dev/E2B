---
"e2b": patch
"@e2b/python-sdk": patch
---

feat: add `sendStdin`/`send_stdin` and `closeStdin`/`close_stdin` to `CommandHandle`

You can now send and close stdin directly on a background command handle instead of going through `sandbox.commands` with the command's PID.
