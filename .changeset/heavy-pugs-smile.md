---
"@e2b/python-sdk": patch
---

Fix several command and PTY streaming issues:

- Decode stdout/stderr incrementally so multibyte UTF-8 characters split across stream chunks are no longer corrupted
- Return `None` instead of empty strings for unset `tag` and `cwd` fields in `commands.list()`
- Close command/PTY/watch stream connections when establishing the stream fails, instead of leaking pooled connections
- Avoid mutating the caller's `envs` dict when applying default `TERM`/`LANG`/`LC_ALL` values in `pty.create()`
