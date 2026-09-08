---
name: setting-up-testing-environment
description: "Initialize the E2B repo for local testing: toolchain versions, dependency install, SDK/CLI builds, and credentials. Use at the start of any session that will run or test code in this repo."
---

# Setting Up the Testing Environment

## Toolchain

`.tool-versions` at the repo root is the source of truth (CI parses it): Node 22.x, pnpm, Python 3.10, uv, deno. Locally, `source ~/.nvm/nvm.sh && nvm use 24` also works for all packages (the CLI needs Node ≥ 20).

Use pnpm for Node and uv for Python — never npm/yarn/pip.

## Install and build

```bash
pnpm install                                  # repo root; installs all workspaces
pnpm --filter e2b build                       # js-sdk -> packages/js-sdk/dist
pnpm --filter @e2b/cli build                  # cli    -> packages/cli/dist/index.js
cd packages/python-sdk && uv sync             # python env (uv run ... after this)
```

## Credentials

- `E2B_API_KEY` is required for anything that touches real sandboxes (most js-sdk tests, python `tests/sync|async`, CLI integration tests, live CLI commands). It's read from the environment; defaults may also live in `.env.local` at the repo root or `~/.e2b/config.json`.
- `E2B_DOMAIN` switches the target environment (unset = production).
- `E2B_DEBUG` switches suites to a local envd; only set it when you're running envd locally.
- Never run `e2b auth login` in headless environments — export the key instead.

## Smoke check

```bash
cd packages/cli && node dist/index.js sandbox list        # verifies key + build
cd packages/js-sdk && npx vitest run --project connectionConfig   # offline, no key
cd packages/python-sdk && uv run pytest tests/test_connection_config.py -q
```

Then use the package-specific skills: `testing-js-sdk`, `testing-python-sdk`, `testing-cli`, `verifying-cli-visual-output`.

## Devin Secrets Needed
- `E2B_API_KEY`
