---
"@e2b/python-sdk": patch
---

Retry connection establishment on the HTTP/2 transports used for the E2B API and envd clients (3 retries by default, configurable via the `E2B_CONNECTION_RETRIES` environment variable).
