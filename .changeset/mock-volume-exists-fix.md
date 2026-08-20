---
'e2b': patch
---

Fix `Volume.exists()` to return `false` for missing paths again — `getInfo()` now throws `VolumePathNotFoundError` (which no longer subclasses the deprecated `NotFoundError`), so the 404 catch is updated accordingly.
