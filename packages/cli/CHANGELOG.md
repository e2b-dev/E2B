# @e2b/cli

## 2.24.0

### Minor Changes

- c0211e9: The CLI now authenticates every request with your login's access token instead of a stored API key.

  - `e2b auth login` opens `https://e2b.dev/auth/cli` (or `https://$E2B_DOMAIN/auth/cli`). The `E2B_DOCS_BASE` override is removed.
  - Access tokens are refreshed automatically before they expire, including during long-running commands such as `sandbox logs --follow`, `sandbox metrics --follow` and an attached `sandbox create` session. Refreshes are serialized across concurrent `e2b` processes, so running several commands at once no longer risks signing you out.
  - `--project`, `E2B_PROJECT_ID` and the project chosen with `e2b auth configure` select the project for each request.
  - The project API key in `~/.e2b/config.json` plays no role any more: it is neither used for requests nor written by `e2b auth login`. After downgrading to a CLI version that authenticates with it, run `e2b auth login` again.
  - `E2B_API_KEY` still works and takes precedence, for CI/CD and other non-interactive use.

- 29fe119: `E2B_ACCESS_TOKEN` authenticates the CLI with an OAuth access token, for CI and other places without a login. It needs `E2B_PROJECT_ID`, which is the project for every request, like `E2B_API_KEY` decides the project on its own; setting both credentials is refused, and a stored login is ignored while the token is set. `e2b workspace list` and `e2b project list` work with the token alone, to find the project to set; `e2b project use` doesn't work with it. The token is used as is: once it expires, set a new one. The variable once held the dashboard's access tokens, which no longer work: such a value is ignored with a warning, as if the variable were unset.
- 07dc47a: Upgrade commander to v15. Commands now reject unexpected extra positional arguments (e.g. `e2b sandbox pause <id> <extra>`) with an error instead of silently ignoring them.
- 6a976f3: `e2b template list` and `e2b template delete` now use the SDK's `Template.list()` and `Template.delete()`. `TemplateInfo` gains `maxCpuCount` (`max_cpu_count` in Python) for resizable templates.

  Breaking: `e2b template list -f json` now prints the SDK's `TemplateInfo` objects (`templateId`, `buildId`, `names`, …) instead of the raw API response (`templateID`, `buildID`, `aliases`, `createdBy`, …), and the pretty table drops the `Created by` column (the API deprecated the creator's email).

- 805da6c: Add commands for workspaces and projects:

  ```sh
  e2b workspace list                    # workspaces you can access
  e2b project list [--workspace <ws>]   # projects, the current one marked with *
  e2b project use [project] [-w <ws>]   # set the project commands run in, or pick one
  e2b project info                      # the current project
  ```

  A project can be given by its ID, `prj_` ID, slug or name. `project use` without a project asks for the workspace and then the project; `--workspace` picks from that workspace only and scopes a name to it. Commands run in the project from `E2B_PROJECT_ID`, then the one chosen with `e2b project use` (or `e2b auth configure`, which picks it interactively). With `E2B_API_KEY` set, the API key determines the project.

- d7dbb7e: `e2b auth login` and `e2b auth configure` list your workspaces and projects from workspace-api instead of the API's `GET /teams`, which created a new API key in every project on each call.

  - Login asks for the workspace and then the project, with your personal workspace and its project preselected. Without a terminal, the personal project (or your only active one) is used. `e2b auth configure` asks the same way, with the current project preselected. Blocked projects show a warning.
  - Requests go to the selected project's own control plane, so projects outside the default region work.
  - `E2B_PROJECT_ID` (and `--project` where available) accepts a project's ID, `prj_` public ID, slug or name.
  - workspace-api is reached at `workspace-api.e2b.dev` (for `E2B_DOMAIN` `e2b.app` and `e2b.dev`), or at `E2B_WORKSPACE_API_URL`. Logging in needs it: on any other `E2B_DOMAIN`, use `E2B_API_KEY`.

- 678d579: Validate all CLI options and arguments with zod. Invalid values now fail before the command runs, with a message naming the option, e.g. `error: option '-l, --limit <limit>' argument 'abc' is invalid. --limit must be a non-negative integer.`

  Inputs that used to be silently accepted are now rejected:

  - `--limit` on `sandbox list` and `sandbox snapshot list` must be a non-negative integer (non-numeric values used to become `NaN`).
  - `-e, --env` entries without `=` (e.g. `-e KEY`) are rejected instead of ignored.
  - `-m, --metadata` pairs without `=` are rejected instead of ignored, and values may now contain `=`.
  - Integer options no longer accept forms like `1e3` or `0x10`.

  `--format` (case-insensitive), `--level`, the `template create` name and an odd `--memory-mb` are now rejected when parsed, not after the command starts. Invalid `e2b.toml` files list every invalid field instead of only the first. `template_id` and `dockerfile` must be non-empty, and `cpu_count`/`memory_mb` must be integers (quoted numbers like `"2"` are still accepted).

- 6ee9a4b: Add resizable templates: build a template with `maxCpuCount` and pick each sandbox's `cpuCount` on create. `e2b template list` shows a `Max vCPUs` column.

### Patch Changes

- ede6629: Interactive prompts (`template init`, `template migrate`, `template delete`/`publish` confirmations, project pickers) now use `@clack/prompts` instead of Inquirer. Canceling a prompt (Ctrl+C or Esc) prints `Canceled` and exits with code 130.
- 8382945: Stop showing `(default: {})` for the repeatable `-e, --env` option in `e2b sandbox create`, `connect` and `exec` help.
- 07dc47a: `e2b sandbox list` and `e2b sandbox kill` now reject unknown `--state` values (anything other than `running` or `paused`) instead of sending them to the API.
- 419e939: Fix `e2b template create --no-cache` not skipping the build cache
- Updated dependencies [6a976f3]
- Updated dependencies [1b3b2a4]
- Updated dependencies [6ee9a4b]
- Updated dependencies [106efea]
- Updated dependencies [cf7208a]
- Updated dependencies [c513ae1]
- Updated dependencies [e50db00]
  - e2b@2.64.0

## 2.23.0

### Minor Changes

- a94b697: - `e2b template list` pages through `GET /v2/templates` like `e2b sandbox list`: up to 1000 templates by default in pretty output (JSON output stays unlimited), `-l, --limit <limit>` to change it (`0` for no limit), and a hint in pretty output when more exist.
  - Breaking: the interactive `-s, --select` mode of `e2b template delete`, `publish` and `unpublish` is removed; the template is now a required argument, and their unused `-t, --project` and `--team` options are removed.

## 2.22.3

### Patch Changes

- a398b08: `e2b sandbox connect`/`create` send terminal input over a single persistent stream instead of one request per 10ms batch
- Updated dependencies [3c4c7cf]
  - e2b@2.58.0

## 2.22.2

### Patch Changes

- b8afc34: Bundle `@e2b/dockerfile-utils` from source so the CLI build no longer races with concurrent workspace package rebuilds during release

## 2.22.1

### Patch Changes

- 999782e: Share the process kill implementation between commands and PTY, share the CLI `--language` option parser between `template init` and `template migrate`, and drop unused internal exports
- Updated dependencies [a1ad326]
- Updated dependencies [9f4a9ef]
- Updated dependencies [999782e]
  - e2b@2.57.0

## 2.22.0

### Minor Changes

- 6a74c39: Require Node.js 22.19.0 or newer and depend on `undici@^8` only (undici 7 is dropped).

  - undici 8 respects the server's HTTP/2 `SETTINGS_MAX_CONCURRENT_STREAMS` and opens more connections when one is saturated.
  - Breaking: the SDK-level in-flight request cap is removed, along with the `E2B_API_INFLIGHT_REQUESTS`, `E2B_ENVD_INFLIGHT_REQUESTS` and `E2B_ENVD_RPC_INFLIGHT_REQUESTS` env vars. Concurrency is governed by undici's connection pools (`E2B_API_CONNECTIONS`, `E2B_ENVD_RPC_CONNECTIONS`).

- 73a784d: Require Node.js 22 or newer (Node.js 20 is no longer supported).

### Patch Changes

- Updated dependencies [6a74c39]
- Updated dependencies [73a784d]
  - e2b@2.56.0

## 2.21.2

### Patch Changes

- 001406c: Bump `handlebars` to 4.7.10 to fix CVE-2026-106446 and CVE-2026-106445 (critical) and CVE-2026-106444 (moderate).
- Updated dependencies [b52cd30]
- Updated dependencies [0894595]
  - e2b@2.55.0

## 2.21.1

### Patch Changes

- 4813482: Bump dependency floors: `undici` `^7.29.1 → ^7.30.0` and optional `undici8` `8.10.2 → 8.11.2` (backported HTTP/2 WebSocket, decompression backpressure and aborted-request fixes), `compare-versions` `^6.1.0 → ^6.1.1` in `e2b`, and `inquirer` `^12.10.0 → ^12.11.1` in `@e2b/cli`.
- Updated dependencies [cc29617]
- Updated dependencies [3ba1d05]
- Updated dependencies [4813482]
- Updated dependencies [d0ed5c1]
  - e2b@2.52.1

## 2.21.0

### Minor Changes

- 2de0cc3: Cap sandbox fork count at 20. `e2b sandbox fork --count`, JavaScript `Sandbox.fork({ count })`, and Python `Sandbox.fork(count=...)` reject a count outside 1–20 before the API call. Counts from 21 through 100 used to reach the API. Omitting count still leaves the field off the request so the API default applies.

### Patch Changes

- 8c7e5cb: Update the protobuf and OpenAPI clients, terminal styling, and interactive prompts to compatible minor releases.
- Updated dependencies [2de0cc3]
- Updated dependencies [03887ad]
- Updated dependencies [2f92cc3]
- Updated dependencies [8c7e5cb]
- Updated dependencies [97522f8]
- Updated dependencies [8c7e5cb]
- Updated dependencies [4975149]
  - e2b@2.52.0

## 2.20.0

### Minor Changes

- 6a608ef: Add `e2b sandbox fork` command to fork a running sandbox into one or more new sandboxes

## 2.19.1

### Patch Changes

- 5b015ad: Removed the hidden `e2b template build` command (alias `bd`). It printed a V1 deprecation notice and exited 1; the V1 build system it fronted is gone from the API. A script still calling it now gets commander's unknown-command error with the same exit code. Build templates with `e2b template create` or the Template SDK; `e2b template migrate` still converts a V1 project (see https://e2b.dev/docs/template/migration-v2).
- Updated dependencies [956e3ab]
- Updated dependencies [e1fbe86]
- Updated dependencies [80496c0]
- Updated dependencies [5b015ad]
- Updated dependencies [80496c0]
- Updated dependencies [e1fbe86]
  - e2b@2.50.0

## 2.19.0

### Minor Changes

- f842aa8: Expose a configurable minimum free-disk target with `minFreeDiskMb` in JavaScript, `min_free_disk_mb` in Python, and `--min-free-disk-mb` in `template create`. Omission uses the team default, while explicit zero requests no minimum growth. Growth is best effort and never shrinks an existing filesystem.

### Patch Changes

- Updated dependencies [f842aa8]
  - e2b@2.49.0

## 2.18.2

### Patch Changes

- b8b4323: Skip the update check when the `NO_UPDATE_NOTIFIER` environment variable is set, so system package managers (for example Nix) can install the CLI without it suggesting updates they cannot apply. Help output now always names the program `e2b` instead of echoing the entrypoint file name.
- Updated dependencies [08efa36]
- Updated dependencies [6b759bf]
- Updated dependencies [58c81f1]
  - e2b@2.48.0

## 2.18.1

### Patch Changes

- 3289fdc: Remove unused CLI formatting helpers and de-duplicate internal constants
- Updated dependencies [cd921aa]
- Updated dependencies [1980d6b]
- Updated dependencies [043d050]
- Updated dependencies [3289fdc]
  - e2b@2.47.0

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
