---
"@e2b/python-sdk": patch
"@e2b/cli": patch
"e2b": patch
---

Support sending input to a PTY directly through the command handle (`handle.send_stdin` / `handle.sendStdin`), matching the regular command handle. Previously stdin could only be sent via the PID-keyed `sandbox.pty.send_stdin` / `sandbox.pty.sendInput`, and calling `handle.send_stdin` raised "Sending stdin is not supported for this command handle." PTY input methods now also accept `str` input, encoding it as UTF-8.

In the JS SDK, `sandbox.pty.sendStdin()` is added as the canonical PTY input method to mirror `sandbox.commands.sendStdin()`; the existing `sandbox.pty.sendInput()` remains as a deprecated alias. The CLI is migrated onto `sendStdin()` internally (no behavior change).
