---
"e2b": minor
"@e2b/python-sdk": minor
---

Add `httpsPorts` (JS) / `https_ports` (Python) to the sandbox network config. Ports listed there have their public URLs proxied to the sandbox over HTTPS — use it when the service listening on the port serves TLS itself. This is not TLS passthrough: traffic is still terminated at the E2B proxy and re-encrypted on the hop to the sandbox, and the backend certificate is not verified, so self-signed certificates work. The configured ports are also returned in the sandbox info network config.
