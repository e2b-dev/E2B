---
'@e2b/python-sdk': patch
---

Percent-encode sandbox, snapshot, volume, secret and build IDs into the request path, and refuse an empty ID, `.` and `..` with `InvalidArgumentException`. The IDs were written into the URL as given, so `Sandbox.kill("../templates/x")` sent `DELETE /templates/x`. The JS SDK already encoded them.
