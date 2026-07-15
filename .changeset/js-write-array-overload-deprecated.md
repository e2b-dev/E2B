---
"e2b": patch
---

Mark the array overload of `files.write()` as `@deprecated` in favor of
`files.writeFiles()`. The overload keeps working; it will be removed in the
next major version.
