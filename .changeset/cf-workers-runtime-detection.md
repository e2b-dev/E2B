---
'e2b': patch
---

Detect the Cloudflare Workers runtime before the generic Node check so Node compatibility shims (workerd's `nodejs_compat`, `@cloudflare/vitest-pool-workers`) no longer make the SDK load `undici` inside Workers
