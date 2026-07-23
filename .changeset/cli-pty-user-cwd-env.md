---
"@e2b/cli": patch
---

Add `--user`, `--cwd`, and `--env` flags to `e2b sandbox create` (and the deprecated `spawn` alias) and `e2b sandbox connect`. These are forwarded to the underlying PTY session so the connected terminal starts as the given user, in the given working directory, and with the given environment variables. `--env` accepts repeatable `KEY=VALUE` pairs.
