---
'e2b': patch
---

Retry requests to the sandbox (envd RPC and HTTP) that fail to establish the connection (`ECONNREFUSED`, DNS, unreachable host, …), using the `retries` count and backoff of the control-plane client. Only connection-establishment failures are retried — the request never left, so unary and streaming calls alike are safe to resend — never responses or errors after the request was sent. This matches the Python SDK's connection retries.
