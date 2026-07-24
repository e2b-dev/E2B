---
'@e2b/python-sdk': patch
---

Enable TCP keepalive with a 60-second initial delay where supported across Python SDK HTTP transports, including API, sandbox, volume, proxy, and template upload connections. Environment proxies (`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`) are now honored by these transports, including template uploads.
