---
'e2b': minor
'@e2b/python-sdk': minor
---

Add paused sandbox retention: how long a sandbox may stay paused and unused before it is deleted. Set it on create with `lifecycle.pausedRetentionMs` (Python: `lifecycle["paused_retention"]`, in seconds), change or remove it later with `setPausedRetention()` (Python: `set_paused_retention()`), which also works on paused sandboxes. Sandbox info reports the setting (`lifecycle.pausedRetentionMs` / `lifecycle["paused_retention"]`) and when a paused sandbox will be deleted (`pausedExpiresAt` / `paused_expires_at`, also on list results).
