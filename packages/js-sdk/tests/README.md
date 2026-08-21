# JS SDK tests

The suite has two tiers.

## Unit tier (default)

```bash
pnpm test
```

Fully mocked (msw over the API and envd endpoints), deterministic, no sandboxes,
no credentials, seconds to run. It asserts on client-side logic: request payload
shaping, config propagation, version gating, response parsing and format
switching, RPC/API error mapping, pagination, URL construction and pure
utilities.

Vitest projects: `unit`, `template`, `connectionConfig`. The other runtimes run
the same tier: `pnpm test:bun`, `pnpm test:deno`, `pnpm test:cf`.

## E2E tier (opt-in)

```bash
E2B_API_KEY=e2b_... pnpm test:e2e
E2B_API_KEY=e2b_... pnpm test:browser
```

Everything whose assertions depend on real behavior across the RPC boundary —
process execution, filesystem round-trips, PTY semantics, git inside the VM,
sandbox lifecycle against live infrastructure and server-side template builds.
It provisions sandboxes and builds templates, so it needs `E2B_E2E=1` (set by
the scripts above) and an API key. Without the opt-in these tests are skipped.

The file list lives in [`e2eFiles.mts`](./e2eFiles.mts) and drives both the
`e2e` project and the exclusions of the default projects, so a new behavioral
test only needs to be added there. Use `e2eTest`, `e2eBuildTemplateTest` or the
`sandboxTest` fixture from [`setup.ts`](./setup.ts) — all three skip unless
`E2B_E2E` is set — and their `hostedTest`/`hostedSandboxTest` variants when a
local envd can't stand in for the real thing (control plane, traffic proxy,
snapshots), which additionally skip under `E2B_DEBUG`.

`E2B_DEBUG` is a separate axis: it points the SDK at a local envd instead of a
provisioned sandbox and does not enable or disable either tier.

## Where a module's tests land

Volume and Secret are entirely request-shaping, error mapping and pagination, so
they sit in the unit tier over an in-memory mock of their APIs. The one
exception is real mount content: `volume/mount.test.ts` writes through a mounted
volume in one sandbox and reads it back in another, which only a live mount can
exercise.

## CI

`SDK Tests` runs the unit tier on every PR. The e2e tier runs in the opt-in
`SDK E2E Tests` workflow — add the `e2e` label to a PR or dispatch it manually.
