---
'@e2b/code-interpreter': patch
---

Document that `logs.stdout`, `logs.stderr` and `OutputMessage.line` hold raw chunks with newlines kept (join them with `''` to rebuild the output), and that `Result.png`, `Result.jpeg` and `Result.pdf` are base64-encoded.
