---
'e2b': patch
---

Remove the `new Function('return import(...)')` trick from undici loading. `loadUndici` now uses the shared `dynamicImport` helper, whose dynamic import is kept opaque to downstream bundlers with `webpackIgnore`/`@vite-ignore` annotations instead of runtime code generation. Environments that disallow code generation from strings (CSP, `--disallow-code-generation-from-strings`) now load undici normally instead of silently falling back to the global fetch.
