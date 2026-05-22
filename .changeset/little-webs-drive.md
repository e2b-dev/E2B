---
'@e2b/python-sdk': minor
'e2b': minor
---

- Fix lifecycle and autopause precedence
- Deprecate auto_pause, use `lifecycle={"on_timeout": "pause"}` instead
