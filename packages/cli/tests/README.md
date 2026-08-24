# CLI tests

The suite has two tiers.

## Unit tier (default)

```bash
pnpm test
```

Fully mocked (`vi.mock` over `e2b` and the CLI's API modules) or driving the
built CLI against local input only — deterministic, no sandboxes, no
credentials. It asserts on argument parsing, validation, output formatting and
the calls the CLI makes into the SDK.

## E2E tier (opt-in)

```bash
E2B_API_KEY=e2b_... pnpm test:e2e
```

Tests that drive the built CLI against a real sandbox (`exec` piping,
`backend_integration`). They need `E2B_E2E=1` (set by the script above) plus
credentials, from `E2B_API_KEY` or `~/.e2b/config.json`; without both they are
skipped.

Use `e2eTest` (or `skipE2E` in a `beforeAll`) from [`setup.ts`](./setup.ts),
which also resolves the shared `e2eApiKey`/`e2eDomain`. `E2B_DEBUG` is a
separate axis and disables the e2e tier because it points the CLI at a local
stack.

## CI

`SDK Tests` runs the unit tier on every PR. The e2e tier runs in the opt-in
`SDK E2E Tests` workflow — add the `e2e` label to a PR or dispatch it manually.
