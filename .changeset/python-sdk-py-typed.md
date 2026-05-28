---
'@e2b/python-sdk': patch
---

Mark the Python SDK as typed (PEP 561). Added `py.typed` markers to the `e2b` and `e2b_connect` packages so type checkers like mypy and Pyright honor the inline annotations on `Sandbox`, `AsyncSandbox`, and other public APIs instead of treating imports as `Any`.
