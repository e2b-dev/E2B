---
'@e2b/desktop-python': minor
---

Deprecate the `secure` option of `Sandbox.create` (still accepted, now ignored): every sandbox is created through the v2 API, which always secures envd access. `allow_internet_access` is no longer preset to `True`; when omitted, the API default applies.
