---
"@e2b/python-sdk": patch
"e2b": patch
---

Allow HTTP requests to opt into retries after `429` responses using the server's delta-seconds `Retry-After` delay. Retries remain disabled by default, are skipped for streamed uploads, and stop when waiting would exhaust the request timeout.
