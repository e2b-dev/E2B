---
"@e2b/python-sdk": patch
---

Restore backwards compatibility for the SDK v1 list form of `files.write()`:
passing a list of `WriteEntry` objects now emits a `DeprecationWarning` and
delegates to `files.write_files()` instead of failing with a `TypeError`. The
typed signature of `write()` stays single-file only (`path` + `data`) — use
`write_files()` for batch writes. Calling `write()` without `data` now raises
`InvalidArgumentException`.
