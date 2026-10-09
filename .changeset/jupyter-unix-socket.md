---
'@e2b/code-interpreter-template': patch
---

Isolate Jupyter behind a private Unix socket (`/run/e2b-jupyter/server.sock`, mode `0600`) instead of TCP port 8888, so Jupyter's HTTP API, kernel WebSockets, and interrupts are no longer reachable over the sandbox network interface.
