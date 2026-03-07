---
"e2b": patch
---

fix: prevent shell command injection in MCP config interpolation

Use proper shell escaping (shlex.quote for Python, shellEscape for JS) when interpolating MCP config JSON into shell commands, preventing single-quote breakout and arbitrary command execution inside sandboxes.
