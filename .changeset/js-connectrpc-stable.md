---
"e2b": minor
---

Modernize the JS SDK's networking and runtime dependencies:

- `@connectrpc/connect` and `@connectrpc/connect-web` move off the `2.0.0-rc.3` pre-release pin to the stable `^2.1.2` line, and `@bufbuild/protobuf` moves from `^2.6.2` to `^2.12.1`.
- `undici` upgrades from `^7.28.0` to `^8.5.0`.

Because `undici` 8 requires Node.js `>=22.19.0`, the SDK's minimum supported Node version is raised from `20.18.1` to `22.19.0`. Node 20 reached end-of-life on 2026-04-30, so this drops a runtime that no longer receives upstream security or bug fixes. There are no public API changes — the sandbox filesystem and command RPCs continue to use the same Connect transport configuration.
