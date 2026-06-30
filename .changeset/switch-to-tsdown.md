---
"@e2b/cli": patch
"e2b": patch
---

Switch the build tooling from `tsup` to `tsdown`. The published artifacts are unchanged: the SDK still ships `dist/index.js` (CJS), `dist/index.mjs` (ESM) and `dist/index.d.ts`/`dist/index.d.mts`, and the CLI still ships an executable `dist/index.js` with its `dist/templates`. This is an internal tooling change with no public API or runtime behavior changes.
