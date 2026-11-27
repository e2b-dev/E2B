---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

`open()` and `launch()` now shell-quote the file, URL, application and URI they pass to `xdg-open` / `gtk-launch`. Before, a URL with `&` in its query string was cut at the `&` (the rest ran as a separate shell command), and a path with spaces was split into several arguments.
