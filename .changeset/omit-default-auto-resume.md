---
'e2b': patch
'@e2b/python-sdk': patch
---

Omit `autoResume` from sandbox creation requests when callers do not configure it, while preserving explicit `false` and `true` values. This lets the API distinguish an unset preference from an explicit opt-out and apply its own default.
