---
"@e2b/python-sdk": patch
---

Run every persistent HTTP stack in the SDK on one shared pyqwest connection pool
instead of four: the control-plane REST API, the envd HTTP API, the envd RPC
clients, and the volume content API now all draw from
`e2b.api.client_sync`/`client_async`, keyed on the three knobs that are fixed
when a pyqwest transport is built — proxy, idle read bound, and HTTP version.
reqwest pools per host internally, so one pool serves the API host and every
per-sandbox host without interference — and since envd RPC and the envd HTTP API
hit the same host, an active sandbox now needs a single HTTP/2 connection instead
of one per stack. Streamed downloads keep a pool of their own, the only one
carrying the idle `read_timeout`: reqwest's read timer runs during body send and
TTFB, so on a shared pool it would cut off long uploads. No signature changes —
`get_transport` and `get_envd_transport` keep the `http2` parameter restored in
2.39.1, and the two are now the same pool per key rather than two.
