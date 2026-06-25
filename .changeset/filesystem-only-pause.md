---
"e2b": minor
"@e2b/python-sdk": minor
---

Add a `keepMemory` (`keep_memory` in Python) option to `pause` for
filesystem-only snapshots.

When `keepMemory` is `false`, pausing drops the in-memory state and captures
only the filesystem (no memory snapshot); resuming such a snapshot cold-boots
(reboots) the sandbox from disk, losing running processes and open connections.
Defaults to `true` (full memory snapshot), so existing callers are unaffected.

```python
# Python
sbx.pause(keep_memory=False)          # filesystem-only snapshot
```

```ts
// JS/TS
await sandbox.pause({ keepMemory: false })   // filesystem-only snapshot
```
