# @e2b/cli

## 2.18.0

### Minor Changes

- 3b599b8: Stop reading `e2b.toml` in `sandbox create`, `template delete` and `template publish`/`unpublish`, and remove their `--config` and `--path` options. Templates must now be passed as an argument or picked interactively with `-s`. `template migrate` is unchanged and remains the only command that reads `e2b.toml`.

### Patch Changes

- 587c15f: Pass flags following the command in `e2b sandbox exec` to the remote command instead of parsing them as CLI options
- 8943d6f: Update runtime dependencies: `tar` 7.5.22 and `@bufbuild/protobuf` 2.14.0 in the JS SDK, `statuses` 2.0.2, `async-listen` 3.1.0 and `yup` 1.7.1 in the CLI. No behavior change.
- 3202fad: `e2b sandbox create --detach` now prints only the sandbox ID to stdout; the dashboard inspect link and other informational output go to stderr so the ID is easily parseable (e.g. `SBX=$(e2b sandbox create -d)`).
- 182b498: Point the README documentation links at `docs.e2b.dev` instead of `e2b.dev/docs`. The docs site moved to its own subdomain and has no `/docs` path prefix there, so `e2b.dev/docs` serves a 308 to `docs.e2b.dev/` and `e2b.dev/docs/code-interpreting` maps to `docs.e2b.dev/code-interpreting`. The UTM parameters are unchanged and survived the redirect, so this removes a redirect hop rather than fixing broken attribution.
- Updated dependencies [67c06e0]
- Updated dependencies [8943d6f]
- Updated dependencies [182b498]
- Updated dependencies [b802997]
- Updated dependencies [9d1c90d]
  - e2b@2.46.0

## 2.17.1

### Patch Changes

- f69a9c0: `e2b sandbox list --format json` now applies the same start-time sorting as the pretty table output (ascending by default, respecting `--order`).
- bc14dd0: Render CLI tables in kubectl style: uppercase headers, space-aligned columns, no borders or titles

## 2.17.0

### Minor Changes

- b53deac: Add `e2b sandbox snapshot` commands: `create <sandboxID>` (with optional `--name`) to create a snapshot from a sandbox, `list [sandboxID]` (with optional `--name` filter and `--format json`) to list snapshots, and `delete <snapshotIDs...>` to delete snapshots.
- 8787dfe: Add sorting and new filters to `Sandbox.list`. The `order` option (`'asc'` / `'desc'`, default `'desc'`) sorts sandboxes by start time across the whole paginated dataset, and the query now supports `startedAfter` / `started_after` (inclusive lower bound on start time) and `template` (exact template ID or alias) filters, all applied server-side before pagination. The CLI `e2b sandbox list` command exposes these via `--order`, `--started-after`, and `--template`.

### Patch Changes

- Updated dependencies [8787dfe]
  - e2b@2.45.0

## 2.16.3

### Patch Changes

- 2daced6: Tag the package homepage and README links with UTM parameters (`utm_source=npm`/`pypi`) so registry traffic to e2b.dev is attributed correctly. No functional change.
- Updated dependencies [15bd48b]
- Updated dependencies [5367693]
- Updated dependencies [7af41e9]
- Updated dependencies [2daced6]
  - e2b@2.42.0

## 2.16.2

### Patch Changes

- 65cd85d: Remove the `E2B_ACCESS_TOKEN` auth path. Authentication moved to Hydra OAuth, so the CLI no longer reads an access token — from the environment or from `~/.e2b/config.json` — to authorize API requests. The API key alone scopes every endpoint the CLI calls, and `e2b auth login` / `e2b auth configure` build their own clients with Hydra JWTs.
- Updated dependencies [6248b12]
  - e2b@2.40.0

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
