---
"@e2b/python-sdk": minor
---

Move the REST API client (sandbox lifecycle, listing, templates, volumes
control plane) onto [`pyqwest`](https://pypi.org/project/pyqwest/) (Rust
reqwest/hyper) via its httpx-compatible transport adapter, replacing the
httpx-native `HTTPTransport`/`AsyncHTTPTransport`. The generated httpx client
API is unchanged — only the transport underneath is swapped — so logging
event hooks, per-request timeouts, and headers behave as before.

Because pyqwest transports are thread-safe and loop-independent (I/O runs on
a Rust runtime), the API connection pool is now shared process-wide per
proxy, instead of one pool per thread (sync) or per event loop (async), and
`ApiClient` no longer maintains per-thread/per-loop httpx client caches — a
single httpx client serves all threads and event loops.
Connection-establishment failures are retried with backoff
(`E2B_CONNECTION_RETRIES`, default 3), matching the connect-only retries of
the previous transports.

`proxy` for API calls now takes a URL string (e.g.
`proxy="http://user:pass@localhost:8030"`, scheme http, https, socks5, or
socks5h). `httpx.URL` and `httpx.Proxy` keep working when they reduce to
such a URL (`httpx.Proxy` auth is folded back into the URL userinfo);
`httpx.Proxy` extras pyqwest can't express — custom headers, an
`ssl_context` — raise `InvalidArgumentException` rather than being silently
dropped.

envd traffic (sandbox commands, filesystem, PTY, file transfers) is not
affected and stays on its existing stack.
