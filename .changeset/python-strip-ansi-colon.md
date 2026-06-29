---
"@e2b/python-sdk": patch
---

fix(python-sdk): strip colon-separated SGR escape codes in build logs

`strip_ansi_escape_codes` now strips CSI parameters that use colons as well as
semicolons, matching the JavaScript SDK's `stripAnsi`. Modern terminals emit
colon-separated SGR sequences (e.g. 256-color `\x1b[38:5:82m`, truecolor
`\x1b[38:2::r:g:bm`, and curly underlines `\x1b[4:3m`), which previously leaked
literal escape garbage into template build log messages on the Python side.
