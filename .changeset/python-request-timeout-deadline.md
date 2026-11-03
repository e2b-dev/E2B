---
'@e2b/python-sdk': patch
---

Enforce `request_timeout` at the value given instead of twice it, on control-plane API, envd HTTP (file read/write, health), volume content and template upload requests. The SDK's pyqwest-backed transport derives one whole-request deadline by adding up httpx's `read` and `write` phases, and the SDK set both to the timeout, so `request_timeout=10` gave up only after 20 seconds (the default 60 seconds after 120). Requests that took between the timeout and twice it now time out at the timeout, as documented and as in the JS SDK.
