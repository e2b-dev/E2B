---
"e2b": patch
---

Recognize Bun and Deno connection-dropped errors in the sandbox health check. When the connection to a sandbox is dropped mid-request, each JS runtime surfaces it with different wording (Node/undici: `terminated`, Bun: `The socket connection was closed unexpectedly`, Deno: `error reading a body from connection`). All known variants are now matched, so a sandbox killed mid-request is reported as a `TimeoutError` on Bun and Deno too, matching Node.
