---
"@e2b/python-sdk": patch
"e2b": patch
---

Fix `proxy` not being applied to volume content requests. `Volume.create`/`Volume.connect` now store the `proxy` on the returned instance, so instance methods (`list`, `readFile`, `writeFile`, `makeDir`, `getInfo`, `updateMetadata`, `remove`, …) route through it without having to pass `proxy` on every call. A per-call `proxy` still takes precedence.
