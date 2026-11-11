---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

`getApplicationWindows` (JS) / `get_application_windows` (Python) returns `[]` instead of `['']` when no window matches: splitting xdotool's empty output on newlines used to report one empty-string window id.
