---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

`getApplicationWindows` (JS) / `get_application_windows` (Python) returns `[]` when no window matches: `xdotool search` exits with status 1 and no output in that case, which used to surface as a `CommandExitError` / `CommandExitException` instead of an empty list. The application name is now also shell-quoted before it is passed to `xdotool`.
