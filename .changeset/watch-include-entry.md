---
"@e2b/python-sdk": minor
"e2b": minor
---

Add an `includeEntry`/`include_entry` option to filesystem directory watching. When enabled, each `FilesystemEvent` carries the affected entry's `EntryInfo` (best-effort; left unset for events where the path no longer exists, such as remove/rename-away). Requires envd 0.6.3 or later; watching with this option against an older sandbox raises a template error.
