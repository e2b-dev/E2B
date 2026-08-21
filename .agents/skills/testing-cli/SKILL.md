---
name: testing-cli
description: "Build, run, and test the E2B CLI (packages/cli) locally. Use when changing CLI commands, running its vitest suites, or executing the CLI against real sandboxes."
---

# Testing the CLI

All commands run in `packages/cli`. Use Node 24 (`nvm use 24`) and pnpm.

## Build and run locally

```bash
pnpm build                       # tsc typecheck + tsdown bundle -> dist/index.js
node dist/index.js --help
node dist/index.js sandbox list
```

Auth: the CLI reads `E2B_API_KEY` from the environment first, then `~/.e2b/config.json` (or `.env.local` at the repo root). Never run `e2b auth login` in headless environments — export the key instead.

Useful non-interactive patterns:

```bash
node dist/index.js sandbox create base --detach          # returns sandbox ID, no attached terminal
node dist/index.js sandbox exec <id> -- bash -lc 'pwd'   # `--` stops CLI flag parsing
node dist/index.js sandbox kill <id>
```

## Automated tests

```bash
pnpm run test                          # vitest; globalSetup runs `pnpm build` first
npx vitest run tests/utils/table.test.ts   # single file
```

- Tests spawn the **built** CLI (`dist/index.js`) via helpers in `tests/setup.ts` (`runCli`, `runCliWithPipedStdin`) — rebuild happens automatically through globalSetup, but if you bypass vitest, run `pnpm build` yourself after editing `src/`.
- `tests/commands/**` cover command behavior; some hit the real API and need `E2B_API_KEY`.
- Unit tests import from `src/` directly (vitest aliases `e2b` to `../js-sdk/src`), so keep command logic in exported, testable functions (see `buildTableRows`/`sortSandboxes` in `src/commands/sandbox/list.ts`).

For checking rendered output (tables, colors, alignment), use the `verifying-cli-visual-output` skill.

## Before committing

```bash
pnpm run lint && pnpm run typecheck
```

Public-surface changes need a changeset (`pnpm changeset` at repo root).
