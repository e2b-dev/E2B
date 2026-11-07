---
'e2b': minor
'@e2b/python-sdk': minor
---

- Discover the control-plane domain from the `X-E2B-Alt-Used` header the global API proxy returns and use it for later API calls in the process (cached per API key).
- The sandbox domain falls back to the discovered domain, so envd traffic reaches the right plane.
- Only applies when `domain`, `apiUrl` and `sandboxUrl` aren't set (as options or `E2B_DOMAIN`/`E2B_API_URL`/`E2B_SANDBOX_URL`) and debug is off.
