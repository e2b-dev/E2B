---
'e2b': patch
---

Fix `Template.fromDockerfile` parsing of `ENV`/`ARG` values that contain whitespace. A quoted value like `ENV NAME="John Doe"` (and an unquoted `ENV KEY=hello world`) was split into a malformed key; it is now parsed as a single value with surrounding quotes stripped, matching the Python SDK. Multiple `key=value` pairs on one line stay separated.
