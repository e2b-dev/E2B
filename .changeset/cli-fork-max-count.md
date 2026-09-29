---
'@e2b/cli': minor
'e2b': minor
'@e2b/python-sdk': minor
---

Cap sandbox fork count at 20. `e2b sandbox fork --count`, JavaScript `Sandbox.fork({ count })`, and Python `Sandbox.fork(count=...)` reject a count outside 1–20 before the API call. Counts from 21 through 100 used to reach the API. Omitting count still leaves the field off the request so the API default applies.
