---
'@e2b/cli': minor
---

Bump `@npmcli/package-json` from `^5.2.1` to `^7.0.5`, clearing the last `npm warn deprecated glob@10.5.0` warning printed on every `@e2b/cli` install (`@npmcli/package-json@5` pinned `glob@10`; `7.0.4` moved to `glob@13`). Together with the `e2b` glob bump, a fresh `npm install @e2b/cli` is now warning-free and drops from 183 to 145 packages.

`@npmcli/package-json@7` requires Node `^20.17.0 || >=22.9.0`, so the CLI's Node 22 floor moves from `>=22` to `>=22.9.0`. Node 20 support is unchanged (`>=20.18.1 <21`). Only the `PackageJson.load`/`create`/`update`/`save` API used by `e2b template init` is touched, and it is unchanged across the bump.
