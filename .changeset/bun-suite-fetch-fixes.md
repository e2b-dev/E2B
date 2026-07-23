---
'e2b': patch
---

Fix fetch handling on non-Node runtimes (Bun, Deno, browsers, edge):

- The SDK now late-binds `globalThis.fetch` instead of capturing the reference at client creation, so a fetch replaced afterwards (msw, instrumentation) is picked up, and per-proxy fetcher cache entries stay distinct.
- Request/idle timeout abort reasons are pinned to their `AbortController` to work around Bun dropping weakly-held `AbortSignal.reason` values, so timeouts on Bun surface as `TimeoutError` instead of an `undefined` reason.
