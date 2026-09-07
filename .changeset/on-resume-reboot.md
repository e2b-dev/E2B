---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `onResume` / `on_resume` to `Sandbox.connect()`: `'reboot'` resumes a paused sandbox from its disk state alone, leaving the memory snapshot untouched, for the case where restoring that memory wedges the guest. `'restore'` stays the default. Where filesystem-only resume is not enabled, a `'reboot'` that would actually drop memory is rejected with an error rather than silently restoring it.
