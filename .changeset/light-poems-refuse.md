---
"e2b": patch
---

Cancel HTTP/2 server streams (`RST_STREAM`) when a command/PTY/watch stream is closed before the server finished it (e.g. `disconnect()`), instead of leaving the stream half-open on the shared envd connection. Abandoned half-open streams stay attached server-side and can block envd's process output fan-out for every other consumer of the same process (#1352, #1587).
