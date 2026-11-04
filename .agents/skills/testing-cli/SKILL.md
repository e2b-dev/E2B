---
name: testing-cli
description: "Build, run, and test the E2B CLI (packages/cli) locally. Use when running its vitest suites or executing the CLI against real sandboxes."
---

# Testing the CLI

All commands run in `packages/cli`. Use Node 24 (`nvm use 24`) and pnpm.

## Build and run locally

```bash
source ~/.nvm/nvm.sh && nvm use 24
pnpm build                       # tsc typecheck + tsdown bundle -> dist/index.js
# or from the repo root: pnpm --filter @e2b/cli build
node dist/index.js --help
node dist/index.js sandbox list
```

Auth: the CLI reads `E2B_API_KEY` from the environment first, then `~/.e2b/config.json` (or `.env.local` at the repo root). Never run `e2b auth login` in headless environments — export the key instead.

Useful non-interactive patterns:

```bash
node dist/index.js sandbox create base -d                # detach: prints sandbox ID, no attached terminal
node dist/index.js sandbox exec <id> -- bash -lc 'pwd'   # `--` stops CLI flag parsing
node dist/index.js sandbox kill <id>
```

The team account usually has other live sandboxes/snapshots, so a truly empty list state may be unreachable; simulate it with a non-matching filter: `node dist/index.js sandbox list --metadata nomatch=zzz` → "No sandboxes found".

There is no CLI flag for custom sandbox metadata — create such sandboxes via the JS SDK instead (build it with `pnpm --filter e2b build`, then `require('<repo>/packages/js-sdk')` from a small node script).

Validate JSON output mode: `node dist/index.js <cmd> --format json | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'`.

## Automated tests

```bash
pnpm run test                          # vitest; globalSetup runs `pnpm build` first
npx vitest run tests/utils/table.test.ts   # single file
```

- Tests spawn the **built** CLI (`dist/index.js`) via helpers in `tests/setup.ts` (`runCli`, `runCliWithPipedStdin`) — rebuild happens automatically through globalSetup, but if you bypass vitest, run `pnpm build` yourself after editing `src/`.
- `tests/commands/**` cover command behavior; some hit the real API and need `E2B_API_KEY`.
- Unit tests import from `src/` directly (vitest aliases `e2b` to `../js-sdk/src`), so they run without building the SDK.

For checking rendered output (tables, colors, alignment), use the `verifying-cli-visual-output` skill.


## Devin Secrets Needed
- `E2B_API_KEY`
