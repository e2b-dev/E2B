---
"@e2b/python-sdk": patch
---

Drop the HTTP read timeout on streaming calls (commands, PTY, watch). It was set to the command `timeout`, so it raced the server's own `deadline_exceeded` response and could intermittently leak a raw `httpcore.ReadTimeout` instead of a `TimeoutException`. The command `timeout` is now enforced solely server-side via the `connect-timeout-ms` header, matching the JS SDK which has no per-chunk read timeout.
