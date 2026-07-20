---
"@e2b/python-sdk": minor
---

Migrate the sandbox RPC layer (commands, PTY, filesystem watch) from the
vendored `e2b_connect` client to the official Connect RPC client for Python
([`connectrpc`](https://pypi.org/project/connectrpc/)), whose HTTP transport
is `pyqwest` (Rust reqwest/hyper), and switch the envd protobuf messages from
Google's `protobuf` runtime to Buf's
[`protobuf-py`](https://pypi.org/project/protobuf-py/).

Closing a command or watch stream early now sends `RST_STREAM` to the server,
so abandoned streams no longer leak on the shared HTTP/2 connection, and peer
resets surface as typed errors instead of ambiguous EOFs. The REST API and
file upload/download keep using `httpx`.

Notes:

- The SDK no longer depends on the `protobuf` package, removing a common
  source of dependency conflicts with other libraries that pin it.
- The `e2b_connect` module is no longer shipped with the package. Code that
  imported it directly should use `connectrpc` (`ConnectError`, `Code`)
  instead; SDK exception types (`SandboxException`, `TimeoutException`, ...)
  are unchanged.
- The generated `e2b.envd.*.*_pb2` modules were replaced by `protobuf-py`
  equivalents (`e2b.envd.process.process_pb`,
  `e2b.envd.filesystem.filesystem_pb`) with a different message API.
- The `proxy` option applies to sandbox RPC calls the same way it does to the
  REST API and file transfer requests. `httpx.Proxy` values with custom
  `headers` or `ssl_context` are rejected for RPC calls — fold credentials
  into the proxy URL instead.
