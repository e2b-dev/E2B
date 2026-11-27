---
"@e2b/python-sdk": patch
"e2b": patch
---

Support sending input to a PTY directly through its handle with `handle.sendInput()` / `handle.send_input()`. Previously input could only be sent via the PID-keyed `sandbox.pty.sendInput()` / `sandbox.pty.send_stdin()`, and calling `handle.send_stdin()` on a PTY raised "Sending stdin is not supported for this command handle." It now raises an error pointing to `send_input()`, since a PTY has no stdin. PTY input methods also accept `str` input, encoded as UTF-8.

In the Python SDK, `sandbox.pty.send_input()` is added to match the JS SDK; `sandbox.pty.send_stdin()` remains as a deprecated alias.
