---
'@e2b/python-sdk': patch
---

Restore the `http2` parameter on `get_transport` and `get_envd_transport`, which the pyqwest migration dropped in 2.38.0. `http2=False` again returns a transport pinned to HTTP/1.1, on its own connection pool.
