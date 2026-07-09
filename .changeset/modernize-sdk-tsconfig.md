---
"@e2b/cli": patch
"e2b": patch
---

Modernize the TypeScript compiler configuration for the JS SDK and CLI and adopt TypeScript 7. Because TypeScript 7.0's native compiler does not yet ship a programmatic API (that lands in 7.1), it is installed side-by-side with TypeScript 6.0: the native `tsc` (aliased as `@typescript/native`) is used for type-checking, while `typescript` resolves to `@typescript/typescript6` so compiler-API tooling (tsdown's `.d.ts` generation and the codegen scripts) keeps working. Alongside this, `tsc` is now type-check only (tsdown owns emit), so `moduleResolution` moves to `bundler`, the js-sdk target/lib is raised to `es2022`, and options that are redundant or removed in TypeScript 7 are dropped. This is an internal build-config change with no public API or runtime behavior changes.
