---
'@e2b/code-interpreter-python': patch
---

Pin the Jupyter transport to HTTP/1.1 with `get_transport(config, http_version="1.1")`, following the renamed argument in `e2b` 2.52.0 (now the minimum supported version).
