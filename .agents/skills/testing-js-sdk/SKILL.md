---
name: testing-js-sdk
description: "Run and write tests for the E2B JavaScript SDK (packages/js-sdk). Use when changing js-sdk code, debugging its vitest suites, or verifying SDK behavior against real sandboxes."
---

# Testing the JS SDK

All commands run in `packages/js-sdk`. Use Node 24 (`nvm use 24`) and pnpm.

## Test projects

Tests are organized into vitest projects in `vitest.config.mts`:

- `unit` — everything in `tests/**/*.test.ts` except runtimes, template, and connectionConfig. Many of these are **integration tests that create real sandboxes** and require `E2B_API_KEY`.
- `template` — template builder tests (`tests/template/**`), 180s timeout, require `E2B_API_KEY`.
- `connectionConfig` — offline config tests.
- `browser` — Playwright/chromium tests (`pnpm run playwright:install` first).

## Running

```bash
# everything (needs E2B_API_KEY)
pnpm run test

# one file — fastest loop, preferred while iterating
npx vitest run tests/api/inflight.test.ts

# one project
npx vitest run --project connectionConfig

# alternate runtimes
pnpm run test:bun    # bun: unit + connectionConfig + template
pnpm run test:deno   # deno: same projects
```

`E2B_API_KEY` is read from the environment or from `.env` via dotenv (the repo also keeps defaults in `.env.local` at the root or `~/.e2b/config.json`). Purely offline unit tests (e.g. `tests/api/inflight.test.ts`, `tests/utils.test.ts`) run without a key.

## Writing tests

- Use the helpers in `tests/setup.ts`: `sandboxTest` / `templateTest` fixtures create and clean up sandboxes; `isDebug` gates behavior when `E2B_DEBUG` is set (local envd at debug port).
- Offline tests that need HTTP mock the API with `msw`; see `tests/api/` for patterns. Test isolation is required (`isolate: true`) because suites patch global fetch.
- SDK changes must be mirrored in the Python SDK (sync + async) with equivalent tests — see `testing-python-sdk`.

## Before committing

```bash
pnpm run lint && pnpm run typecheck
```

Public-surface changes need a changeset (`pnpm changeset` at repo root).
