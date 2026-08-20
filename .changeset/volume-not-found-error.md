---
'e2b': patch
'@e2b/python-sdk': patch
---

Add typed not-found errors for volumes: `VolumeNotFoundError` / `VolumeNotFoundException` (thrown when a volume is not found) and `VolumePathNotFoundError` / `VolumePathNotFoundException` (thrown when a path inside a volume is not found). All subclass the existing `NotFoundError` / `NotFoundException`, so existing catches keep working.
