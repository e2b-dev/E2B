---
"e2b": patch
---

fix: add read/write timeouts to streaming requests to prevent indefinite hangs

Add read and write timeouts to _prepare_server_stream_request to match _prepare_unary_request, preventing commands.run() from hanging indefinitely when a sandbox becomes unreachable.
