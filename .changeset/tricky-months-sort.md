---
'@e2b/cli': patch
---

Fix `sandbox list` sorting sandboxes by locale-formatted date string instead of the underlying timestamp, which broke chronological order across single-digit/double-digit month and day boundaries
