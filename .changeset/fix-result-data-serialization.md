---
"@e2b/code-interpreter": patch
"@e2b/code-interpreter-python": patch
---

Fix `Result.toJSON()` and `Execution.to_json()` to preserve the `data` field when present, including empty objects. Previously, the JS SDK omitted `data` entirely from serialization, and the Python SDK dropped empty `data` objects due to a truthiness check.
