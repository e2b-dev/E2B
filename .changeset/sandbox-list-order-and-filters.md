---
'e2b': minor
'@e2b/python-sdk': minor
---

Add sorting and new filters to `Sandbox.list`. The `order` option (`'asc'` / `'desc'`, default `'desc'`) sorts sandboxes by start time across the whole paginated dataset, and the query now supports `startedAfter` / `started_after` (inclusive lower bound on start time) and `template` (exact template ID or alias) filters, all applied server-side before pagination.
