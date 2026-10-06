---
'e2b': patch
---

Retry connections to the E2B API and to the sandbox (envd) that cannot be established (`ECONNREFUSED`, DNS failure, unreachable host, connect timeout) in Node, `E2B_CONNECTION_RETRIES` times (default 3) with the control-plane client's backoff — the same variable the Python SDK's `ConnectionRetryTransport` reads; `retries` keeps controlling control-plane request retries only. The retry happens at undici's connector level: only the TCP/TLS connect is repeated and the request is dispatched once, so it is safe for every request, unary or streaming. The health probe the SDK runs after a request failed uses no connection retries, so a sandbox that cannot be reached is not tried all over again.
