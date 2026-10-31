---
'@e2b/python-sdk': patch
---

Fix async `watch_dir` / `watch` handle skipping the `on_exit` callback when `stop()` is called before the watch task's first step
