---
'@e2b/python-sdk': minor
'e2b': minor
'@e2b/cli': minor
---

Expose a configurable minimum free-disk target with `minFreeDiskMb` in JavaScript, `min_free_disk_mb` in Python, and `--min-free-disk-mb` in `template create`. Omission uses the team default, while explicit zero requests no minimum growth. Growth is best effort and never shrinks an existing filesystem.
