---
"e2b": patch
---

Move the Connect/Protobuf runtime dependencies off the `2.0.0-rc.3` pre-release pin to the stable line: `@connectrpc/connect` and `@connectrpc/connect-web` upgrade to `^2.1.2`, and `@bufbuild/protobuf` upgrades from `^2.6.2` to `^2.12.1`. No public API changes — the sandbox filesystem and command RPCs continue to use the same Connect transport configuration.
