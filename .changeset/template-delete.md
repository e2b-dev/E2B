---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `Template.delete(nameOrId)` (JS) and `Template.delete(name_or_id)` / `AsyncTemplate.delete(name_or_id)` (Python) to delete a template or snapshot; returns `false` when it isn't found. `Sandbox.deleteSnapshot` / `Sandbox.delete_snapshot` now share its implementation and raise `TemplateError` / `TemplateException` (subclasses of `SandboxError` / `SandboxException`) on failure
