---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `mode: 'full' | 'filesystem'` (exported as the `SnapshotMode` type) to `createSnapshot` / `create_snapshot`. With `'filesystem'`, only the filesystem is persisted: the snapshot is smaller and faster to take, and sandboxes created from it cold-boot (start fresh from disk) instead of restoring memory. The source sandbox keeps running either way. Omitted, the API default (a full memory snapshot) applies.

`pause()` and the `lifecycle.onTimeout` / `lifecycle["on_timeout"]` pause object form accept the same `mode`. Their `keepMemory` / `keep_memory` option is deprecated in favor of it (`keepMemory: false` is `mode: 'filesystem'`) and keeps working; passing both is an `InvalidArgumentError` / `InvalidArgumentException`.
