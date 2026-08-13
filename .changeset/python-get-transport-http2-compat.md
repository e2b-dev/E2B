---
"@e2b/python-sdk": patch
---

Accept and ignore a deprecated `http2` argument on `get_transport` in both the
sync and async REST API clients. The pyqwest move dropped the parameter because
ALPN negotiates the HTTP version now, but every published
`e2b-code-interpreter` calls `get_transport(config, http2=False)`, and its
`e2b>=2.26.0,<3.0.0` range resolves straight to a version that no longer accepts
it. The result was a `TypeError` on the first `run_code()` of any fresh
`pip install e2b-code-interpreter`. The flag is inert, so it is accepted and
ignored rather than removed.
