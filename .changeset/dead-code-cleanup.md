---
'@e2b/python-sdk': patch
'@e2b/cli': patch
'e2b': patch
---

Remove unused internal code: `wait` helper (js-sdk), `asSandboxTemplate`/`asHeadline`/`selectOption`/`basicDockerfile` (cli), and `format_execution_timeout_error` (python-sdk). No public API changes.
