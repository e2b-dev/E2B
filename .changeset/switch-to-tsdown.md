---
"@e2b/cli": patch
"e2b": patch
---

Switch the build tooling from `tsup` to `tsdown`. The published artifacts are unchanged: the SDK still ships `dist/index.js` (CJS), `dist/index.mjs` (ESM) and `dist/index.d.ts`/`dist/index.d.mts`, and the CLI still ships an executable `dist/index.js` with its `dist/templates`.

`engines.node` for both packages is set to `>=20.18.1 <21 || >=22` (Node 20.18.1+, or 22 and above — keeping the minimum required by `undici` while excluding the end-of-life Node 21 line).
