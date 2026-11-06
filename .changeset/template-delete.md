---
'e2b': minor
'@e2b/python-sdk': minor
'@e2b/cli': patch
---

Add `Template.delete(nameOrId)` (JS) and `Template.delete(name_or_id)` / `AsyncTemplate.delete(name_or_id)` (Python) to delete a template or snapshot; returns `false` when it isn't found. `Sandbox.deleteSnapshot` / `Sandbox.delete_snapshot` are deprecated in favor of it and now raise `TemplateError` / `TemplateException` (subclasses of `SandboxError` / `SandboxException`) on failure
