---
'@e2b/cli': minor
---

Add `e2b sandbox port-forward <sandboxID> <local:remote>` (alias `pf`), which forwards a local port to a port inside a running sandbox. The sandbox downloads a pinned, checksum-verified websocat binary, runs it as a WebSocket server in front of the remote port, and tunnels each local TCP connection over its own WebSocket. websocat only accepts connections on a random secret path generated per forward, so the relay is not reachable by anyone who only knows the sandbox ID. Works with sandboxes that restrict public traffic.
