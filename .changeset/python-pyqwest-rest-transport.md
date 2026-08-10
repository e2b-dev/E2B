---
"@e2b/python-sdk": minor
---

Move the REST API client (sandbox lifecycle, listing, templates, volumes
control plane) onto [`pyqwest`](https://pypi.org/project/pyqwest/) (Rust
reqwest/hyper) via its httpx-compatible transport adapter, replacing the
httpx-native `HTTPTransport`/`AsyncHTTPTransport`. The generated httpx client
API is unchanged — only the transport underneath is swapped — so logging
event hooks, per-request timeouts, headers, and redirect handling
(`follow_redirects`, `response.history`) behave as before.

Because pyqwest transports are thread-safe and loop-independent (I/O runs on
a Rust runtime), the API connection pool is now shared process-wide per
proxy, instead of one pool per thread (sync) or per event loop (async), and
`ApiClient` no longer maintains per-thread/per-loop httpx client caches — a
single httpx client serves all threads and event loops.
Connection-establishment failures are retried with backoff
(`E2B_CONNECTION_RETRIES`, default 3), matching the connect-only retries of
the previous transports. Timeouts keep raising `httpx.ReadTimeout` (an
`httpx.TimeoutException`), as before, whether they fire while waiting for the
response head or while reading the response body, and connection, network, and
protocol failures keep raising their `httpx` counterparts (`httpx.ConnectError`,
`httpx.ReadError`, `httpx.RemoteProtocolError`).

`proxy` for API calls takes a URL string (e.g.
`proxy="http://user:pass@localhost:8030"`, scheme http, https, socks5, or
socks5h), an `httpx.URL`, or an `httpx.Proxy` — including its credentials
(sent as `Proxy-Authorization`) and any headers configured for the proxy. The
one `httpx.Proxy` option pyqwest cannot express, a per-proxy `ssl_context`,
raises `InvalidArgumentException` rather than being silently dropped.

Low-level HTTP logs stay available: where enabling the `httpcore` logger used
to show connection-level detail, pyqwest logs one line per request on the
`pyqwest.access` logger and request lifecycle records on `pyqwest`, both at
`DEBUG` and off unless enabled:

```python
import logging

logging.basicConfig()
logging.getLogger("pyqwest.access").setLevel(logging.DEBUG)
# DEBUG pyqwest.access - HTTP Request: POST https://api.e2b.app/sandboxes "HTTP/2 201 Created"
```

The SDK's own `logger` option is unchanged and independent of these.

envd traffic is not affected: RPC (commands, PTY, filesystem watch) already
runs on pyqwest via `connectrpc`, and the envd HTTP API (file transfers,
health checks) keeps its httpx transports.
