---
"@e2b/python-sdk": minor
---

Migrate the sandbox RPC layer (commands, PTY, filesystem watch) from the
vendored `e2b_connect` client to the official Connect RPC client for Python
([`connectrpc`](https://pypi.org/project/connectrpc/)), whose HTTP transport
is `pyqwest` (Rust reqwest/hyper).

Closing a command or watch stream early now sends `RST_STREAM` to the server,
so abandoned streams no longer leak on the shared HTTP/2 connection, and peer
resets surface as typed errors instead of ambiguous EOFs. The REST API and
file upload/download keep using `httpx`.

Notes:

- The `e2b_connect` module is no longer shipped with the package. Code that
  imported it directly should use `connectrpc` (`ConnectError`, `Code`)
  instead; SDK exception types (`SandboxException`, `TimeoutException`, ...)
  are unchanged.
- The `proxy` option is not applied to sandbox RPC calls for now — `pyqwest`
  only honors the standard `http_proxy`/`https_proxy`/`all_proxy` environment
  variables. It still applies to the REST API and file transfer requests.
