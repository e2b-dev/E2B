---
name: testing-js-sdk
description: "Run tests for the E2B JavaScript SDK (packages/js-sdk). Use when debugging its vitest suites or verifying SDK behavior against real sandboxes."
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

Fixtures in `tests/setup.ts` (`sandboxTest`/`templateTest`) create and clean up sandboxes automatically; `E2B_DEBUG` switches suites to a local envd. Fully offline suites (msw-mocked, e.g. `tests/api/`, `tests/volume/`) are the fastest signal when no key is available.

## CI notes

- SDK integration jobs run against both **production and staging**; staging jobs are known to flake (template-build 500s, network-egress curl errors). Before assuming your change broke CI, check whether the same job fails on the base branch or rerun the job.
- New API parameters often work on staging before production — a production-only failure of a new-feature test usually means the API isn't deployed there yet, not a code bug.

