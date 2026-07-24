---
'e2b': patch
---

Fix the lazy fetcher loading in `api/http2.ts` and `envd/http2.ts`: a failed fetcher build is no longer cached forever (the next request retries instead of replaying the stale rejection), and the no-undici fallback now late-binds `globalThis.fetch` so fetch replacements installed after the first request (msw, instrumentation) are picked up. The previously duplicated loading logic is shared in `undici.ts`.
