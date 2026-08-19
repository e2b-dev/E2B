---
'@e2b/python-sdk': patch
---

Raise the `h2` floor to `>=4.4.1` so it can no longer resolve to a version affected by CVE-2026-71554, where a duplicate `Host` header is forwarded to the consuming application and becomes a request smuggling primitive once HTTP/2 is downgraded to HTTP/1.1.
