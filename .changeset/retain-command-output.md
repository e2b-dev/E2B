---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `retainOutput` (JS) / `retain_output` (Python) option to `commands.run` and `commands.connect` (default `true`)

- When `false`, stdout/stderr are not buffered in memory; `stdout`/`stderr` on the handle, result and `CommandExitError`/`CommandExitException` are `undefined`/`None`
- Output callbacks (`onStdout`/`onStderr`, `on_stdout`/`on_stderr`) still receive all output
