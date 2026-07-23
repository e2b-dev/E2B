---
'e2b': patch
---

Fix ESM bundle crashing at import time in Cloudflare Workers (and other edge runtimes) with `The argument 'path' must be a file URL object, a file URL string, or an absolute path string. Received 'undefined'`. Bare `require` calls in the SDK source made the bundler emit an eager `createRequire(import.meta.url)` shim at module scope, which throws in workerd where `import.meta.url` is undefined. SHA-256 hashing now uses WebCrypto directly, `node:url` is imported statically like the other Node.js built-ins, and the build fails if a `require` shim ever reappears in the ESM bundle.
