# @e2b/cli

## 2.16.1

### Patch Changes

- 9e3e52b: Add `--user`, `--cwd`, and `--env` flags to `e2b sandbox create` (and the deprecated `spawn` alias) and `e2b sandbox connect`. These are forwarded to the underlying PTY session so the connected terminal starts as the given user, in the given working directory, and with the given environment variables. `--env` accepts repeatable `KEY=VALUE` pairs.
- 2c061eb: Point the `--project` flag help at the dashboard's `?tab=general` entrypoint (was `?tab=team`)
- 05b7a79: Depend on `e2b` through pnpm's `workspace:^` protocol instead of a registry range. `pnpm publish` rewrites it to the same concrete `^<version>` it had before, so the published package is unchanged — but the lockfile no longer has to be re-resolved against the tarballs a release uploads, which is what forced the release tags onto the commit before their own version bump.
- Updated dependencies [6733f36]
- Updated dependencies [1ebe925]
- Updated dependencies [1504fbc]
- Updated dependencies [ee0ad25]
  - e2b@2.37.0
