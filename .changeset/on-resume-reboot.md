---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `onResume` / `on_resume` to `Sandbox.connect()`: `'reboot'` resumes a paused sandbox from its disk state alone, leaving the memory snapshot untouched, for the case where restoring that memory wedges the guest. `'restore'` stays the default. Deployments without filesystem-only resume enabled reject `'reboot'` with an error rather than silently restoring the memory.
