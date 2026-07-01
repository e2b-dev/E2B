---
"@e2b/cli": patch
"e2b": patch
---

Modernize the TypeScript compiler configuration for the JS SDK and CLI. Bump TypeScript to `^6.0.3`, raise the `js-sdk` compile target/lib to `es2022` (the CLI was already there), switch `moduleResolution` to `bundler` (the bundler owns emit; `tsc` is type-check only), and drop redundant options that are implied by `strict`/`esModuleInterop` or deprecated in TS 6.0. This is an internal build-config change with no public API or runtime behavior changes.
