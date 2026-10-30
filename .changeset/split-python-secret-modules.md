---
'@e2b/python-sdk': patch
---

Split the Python `e2b.secret` package into `e2b.secret` (shared base and types), `e2b.secret_sync` and `e2b.secret_async`, matching the `template` / `template_sync` / `template_async` layout. Imports from `e2b` are unchanged; deep imports of `Secret` / `AsyncSecret` from `e2b.secret` move to `e2b.secret_sync.main` / `e2b.secret_async.main`.
