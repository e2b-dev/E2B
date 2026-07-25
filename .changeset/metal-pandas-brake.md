---
'e2b': patch
---

Detect `Request` inputs by shape instead of `instanceof` in the Node fetch bridge. A `Request` minted by a different `Request` class — runtimes and tools replace `globalThis.Request` the same way they replace `globalThis.fetch` (test environments, instrumentation, server shims such as `@hono/node-server`, or two coexisting copies of one shim) — previously failed the brand check, was passed to undici's `fetch` verbatim, and crashed every API call with `Failed to parse URL from [object Request]`. Such Requests are now destructured into a plain `(url, init)` pair like any other, and their abort signal is honored while queued by the in-flight limiter.
