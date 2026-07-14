---
"@e2b/python-sdk": patch
---

fix(python-sdk): stop leaking per-call proxy connection pools in volume content clients

The volume content clients passed both `proxy` and the shared cached
`transport` to httpx, so with a proxy configured every volume operation mounted
a fresh, never-closed proxy transport. The proxy is already part of the cached
transport, so the client-level `proxy` argument is now dropped. Volume
transports also gained connect-level retries, matching the other transports.
