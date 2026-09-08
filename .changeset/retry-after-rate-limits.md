---
"@e2b/python-sdk": patch
"e2b": patch
---

Retry control-plane HTTP requests up to three times after `429` responses using the server's delta-seconds `Retry-After` delay. Retries can be configured or disabled with `retries`, and stop when waiting would exhaust the request timeout. Envd requests, including filesystem operations, and volume-content requests are not retried.
