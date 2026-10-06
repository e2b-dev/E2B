---
'e2b': patch
---

Retry sandbox (envd) connections that cannot be established (`ECONNREFUSED`, DNS failure, unreachable host, connect timeout) in Node, using the `retries` count and backoff of the control-plane client. The retry happens at undici's connector level — only the TCP/TLS connect is repeated and the request is dispatched once, so it is safe for every request, unary or streaming. This matches the Python SDK's connection retries.
