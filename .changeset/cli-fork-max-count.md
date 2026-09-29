---
'@e2b/cli': patch
'e2b': patch
'@e2b/python-sdk': patch
---

Cap sandbox fork count at 20. `e2b sandbox fork --count`, JavaScript `Sandbox.fork({ count })`, and Python `Sandbox.fork(count=...)` reject a count outside 1–20 before the API call. Omitting count still leaves the field off the request so the API default applies.
