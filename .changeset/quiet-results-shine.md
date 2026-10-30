---
'@e2b/code-interpreter-python': patch
---

Document the `Result` fields in the reference, including that `png`, `jpeg` and `pdf` are base64-encoded, and that `logs.stdout`, `logs.stderr` and `OutputMessage.line` hold raw chunks with newlines kept; use `''.join(execution.logs.stdout)` to rebuild the output.
