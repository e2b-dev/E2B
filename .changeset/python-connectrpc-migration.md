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
  REST API and file transfer requests. RPC calls accept only URL-string
  proxies (credentials in the URL, e.g.
  `proxy="http://user:pass@localhost:8030"`); `httpx.Proxy` and `httpx.URL`
  values are rejected for RPC calls.
- `CommandResult.error` (and `CommandHandle.error`) is now `None` when a
  command finishes without an error, matching the declared `Optional[str]`
  type and the JS SDK's `error?: string`. It used to be `""` on success —
  code comparing `result.error == ""` or treating it as always-`str` should
  check for `None`/falsiness instead.
- For async streaming calls (`commands.run`/`connect`, PTY,
  `files.watch_dir`), `request_timeout` now bounds opening the stream — the
  wait until envd confirms with a start event, matching the JS SDK's
  `requestTimeoutMs` — and raises `TimeoutException` when exceeded. The
  running stream is bounded by the command/watch `timeout` (as before). In
  the sync SDK there is no way to interrupt the blocking wait, so stream
  setup is bounded by the transport's 30 s connect timeout instead.
