---
'@e2b/python-sdk': minor
'e2b': minor
---

- Fix lifecycle and autopause precedence
- Deprecate `auto_pause`/`autoPause`; use `lifecycle={"on_timeout": "pause"}` instead. A `DeprecationWarning` (Python) / `console.warn` (JS) is now emitted when the flag is set
- **Breaking validation change**: passing `auto_resume=true` while the resolved `on_timeout` is `"kill"` now raises `InvalidArgumentException` (Python) / `InvalidArgumentError` (JS)
