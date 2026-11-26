---
'e2b': minor
'@e2b/python-sdk': minor
'@e2b/cli': minor
---

Add resizable memory: build a template with `maxMemoryMB`, pick each sandbox's `memoryMB` on create, and pick the memory and CPUs a paused sandbox resumes with on `Sandbox.connect`. `onResume` (`on_resume`) now also accepts an object, `{ mode, memoryMB, cpuCount }` (`{"mode", "memory_mb", "cpu_count"}` in Python), next to the existing `'restore'` / `'reboot'` strings, which keep working unchanged. The sizes apply only when the connect resumes a paused sandbox, and a size the sandbox cannot take is refused. `Template.list()`, `Template.getInfo()` and `Template.listBuilds()` return `maxMemoryMB`, and `e2b template list` shows a `Max RAM MiB` column.
