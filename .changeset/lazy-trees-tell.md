---
'@e2b/python-sdk': patch
'e2b': patch
---

Background commands (`commands.run(..., background=True)` / `{ background: true }`) now default to no timeout, so they are no longer killed after the default 60s command timeout. Pass an explicit `timeout`/`timeoutMs` to set one.
