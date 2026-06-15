---
"e2b": patch
---

Fix command and PTY streaming issues:

- Decode stdout/stderr incrementally so multibyte UTF-8 characters split across command stream chunks are no longer corrupted
- Avoid mutating the caller's `envs` object when applying default `TERM`/`LANG`/`LC_ALL` values in `pty.create()`
