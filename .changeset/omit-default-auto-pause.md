---
'e2b': patch
'@e2b/python-sdk': patch
---

Omit `autoPause` from sandbox creation requests when the timeout lifecycle is not configured, while continuing to send `false` for an explicit `kill` action. This preserves the distinction between an unset client preference and an explicit opt-out so the API can apply its own default.
