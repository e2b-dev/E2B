---
'e2b': minor
'@e2b/python-sdk': minor
---

Apply `.dockerignore` and `fileIgnorePatterns` / `file_ignore_patterns` the way Docker does when copying files into a template, so ignored files are no longer uploaded or included in the files hash:

- A pattern that matches a directory (`node_modules`, `.git`, `dist/`) now excludes everything under it, and a leading `/` is ignored.
- `!` patterns re-include paths; the last matching pattern wins.
- In Python, patterns now also apply when the copied path contains `.` or `..` segments (for example `copy(".")`).
- `fileIgnorePatterns` / `file_ignore_patterns` are applied after the `.dockerignore` lines, so they take precedence.
- Absolute patterns pointing into the context directory are treated as relative to it.
- Copying a path inside an ignored directory now fails with "No files found", as in Docker. An invalid pattern (such as an unterminated `[`) now raises an error.

The files hash of `copy()` steps affected by ignore patterns changes once, so those steps are rebuilt on the next build.
