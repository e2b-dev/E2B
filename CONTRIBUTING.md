# Contributing
If you want to contribute, open a PR, issue, or start a discussion on our [Discord](https://discord.gg/dSBY3ms2Qr).

## Tests

Every package splits its tests into two tiers:

- **unit (default)** — fully mocked, deterministic, no sandboxes and no
  credentials.
- **e2e (opt-in)** — real sandboxes, envd round-trips and template builds;
  requires `E2B_E2E=1` and an API key.

| Package | Unit | E2E |
| --- | --- | --- |
| `packages/js-sdk` | `pnpm test` | `pnpm test:e2e`, `pnpm test:browser` |
| `packages/python-sdk` | `uv run pytest` | `uv run pytest -m e2e` |
| `packages/cli` | `pnpm test` | `pnpm test:e2e` |

Details, and where a new test belongs, are in each package's
`tests/README.md`. On CI the `SDK Tests` workflow runs the unit tier for every
PR; the e2e tier runs in the opt-in `SDK E2E Tests` workflow (add the `e2e`
label to a PR or dispatch it manually).
