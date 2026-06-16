---
"@e2b/python-sdk": patch
---

Fix flaky `TimeoutException` on streaming calls (commands, PTY, watch). The stream's HTTP read timeout was set to the command `timeout`, so it raced the server's own `deadline_exceeded` response and could leak a raw `httpcore.ReadTimeout`. The read timeout is now dropped on streams — the command `timeout` is enforced server-side via the `connect-timeout-ms` header (matching the JS SDK, which has no per-chunk read timeout). As a safety net, transport-level `httpcore` timeouts are also now mapped to `TimeoutException`.
