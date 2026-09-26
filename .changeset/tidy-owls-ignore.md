---
'e2b': patch
'@e2b/python-sdk': patch
---

Apply `.dockerignore` and `fileIgnorePatterns` in template `copy()` like Docker does, so ignored files stay out of the files hash and the upload. A pattern that matches a directory (`node_modules`, `.git`, `dist/`) now excludes everything inside it, a leading `/` is relative to the context, the pattern `.` is ignored, and `!` patterns re-include paths (the last matching pattern wins, and the parent directories of a re-included path are kept). `fileIgnorePatterns` are applied after the `.dockerignore` lines, so they take precedence, and absolute `fileIgnorePatterns` inside the context apply relative to it. In Python, patterns now also apply when the `copy()` source contains `.` or `..` segments (such as `copy('.')`), and a UTF-8 BOM in `.dockerignore` is stripped. In JS, directories with glob characters in their names (such as `app/[id]`) are now copied with their contents.

The files hash changes once for affected `copy()` steps. Files inside ignored directories are no longer uploaded, and copying a path inside an ignored directory now fails with "No files found" unless a `!` pattern re-includes it.
