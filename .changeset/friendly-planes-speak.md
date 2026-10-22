---
'e2b': minor
'@e2b/python-sdk': minor
---

- Discover the control-plane domain from the `X-E2B-Alt-Used` header the global API proxy returns and use it for later API calls in the process (cached per domain + API key).
- The sandbox domain falls back to the discovered domain, so envd traffic reaches the right plane.
- No switching with a custom `apiUrl`, in debug mode, or when `E2B_DOMAIN`, `E2B_API_URL`, `E2B_SANDBOX_URL` or `E2B_VOLUME_API_URL` is set.
