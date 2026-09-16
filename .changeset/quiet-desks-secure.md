---
'@e2b/desktop-python': minor
---

Remove the `secure` option from `Sandbox.create`: every sandbox is now created through the v2 API, which always secures envd access. `allow_internet_access` is no longer preset to `True`; when omitted, the API default applies.
