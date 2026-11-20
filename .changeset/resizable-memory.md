---
'e2b': minor
'@e2b/python-sdk': minor
'@e2b/cli': minor
---

Add resizable memory: build a template with `maxMemoryMB`, pick each sandbox's `memoryMB` on create, and pick the memory a paused sandbox resumes with through `Sandbox.connect`'s `memoryMB` (`memory_mb`), on a restore or a reboot. `Template.list()`, `Template.getInfo()` and `Template.listBuilds()` return `maxMemoryMB`, and `e2b template list` shows a `Max RAM MiB` column.
