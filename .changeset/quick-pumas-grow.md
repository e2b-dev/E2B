---
"@e2b/python-sdk": patch
---

Avoid quadratic-time stdout/stderr accumulation in command handles by buffering decoded chunks in a list and joining on read instead of repeatedly concatenating onto an instance attribute.
