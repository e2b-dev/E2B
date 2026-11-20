---
'e2b': minor
'@e2b/python-sdk': minor
'@e2b/cli': minor
---

Add resizable memory: build a template with `maxMemoryMB` and pick each sandbox's `memoryMB` on create. `Template.list()`, `Template.getInfo()` and `Template.listBuilds()` return `maxMemoryMB`, and `e2b template list` shows a `Max RAM MiB` column.
