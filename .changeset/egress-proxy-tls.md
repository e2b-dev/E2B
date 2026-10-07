---
"e2b": minor
"@e2b/python-sdk": minor
---

Add `tls` to the egress proxy options (`SandboxEgressProxyTLSOpts`) to connect to a BYOP SOCKS5 proxy over TLS, with optional `serverName`/`server_name` and `caCert`/`ca_cert`; `getInfo`/`get_info` reports it (without the CA).
