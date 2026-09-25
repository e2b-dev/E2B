---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `keepMemory` (JS) / `keep_memory` (Python) to `createSnapshot` / `create_snapshot`. When `false`, only the filesystem is persisted: the snapshot is smaller and faster to take, and sandboxes created from it cold-boot (start fresh from disk) instead of restoring memory. The source sandbox keeps running either way. Omitted, the API default (a full memory snapshot) applies.
