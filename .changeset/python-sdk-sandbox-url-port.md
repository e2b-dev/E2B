---
'@e2b/python-sdk': minor
'@e2b/code-interpreter-python': patch
---

`ConnectionConfig.get_sandbox_url` / `get_sandbox_direct_url` accept an optional `port` (defaults to the envd port). Code Interpreter now requires `e2b>=2.56.0`, the first release that includes it; `e2b-code-interpreter` 2.10.4 calls these methods with `port` and fails against `e2b` 2.55.0.
