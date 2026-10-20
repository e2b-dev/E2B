---
"e2b": minor
"@e2b/python-sdk": minor
---

- JS: `sandbox.commands.streamInput(pid)` / `sandbox.pty.streamInput(pid)` return a `CommandInputHandle` that sends ordered stdin/PTY input over one `StreamInput` RPC.
- Python async: `stream_input(pid)` returns an `AsyncCommandInputHandle`; Python sync: `stream_input(pid, data)` blocks while it sends an iterable of input.
