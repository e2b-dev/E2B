---
'@e2b/code-interpreter-python': patch
---

Fix `Execution.to_json()` double-encoding logs and execution errors as JSON strings instead of nested objects.
