---
'e2b': patch
'@e2b/python-sdk': patch
---

Add `VolumeNotFoundError` (JS) and `VolumeNotFoundException` (Python), thrown when a volume is not found. Both subclass the existing `NotFoundError` / `NotFoundException`, so existing catches keep working.
