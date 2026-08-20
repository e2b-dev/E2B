# Python SDK tests

The suite has two tiers.

## Unit tier (default)

```bash
uv run pytest
```

Fully mocked (`httpx.MockTransport` and monkeypatched generated API modules),
deterministic, no sandboxes, no credentials, seconds to run. It asserts on
client-side logic: request payload shaping, config propagation, version gating,
response parsing and format switching, RPC/API error mapping, pagination, URL
construction and pure utilities.

`pytest.ini` sets `addopts = -m "not e2e"`, so the e2e tier is excluded unless
you ask for it.

## E2E tier (opt-in)

```bash
E2B_API_KEY=e2b_... uv run pytest -m e2e
```

Everything whose assertions depend on real behavior across the RPC boundary —
process execution, filesystem round-trips, PTY semantics, git inside the VM,
sandbox lifecycle against live infrastructure and server-side template builds.
It provisions sandboxes and builds templates, so it needs an API key.

Tests land in this tier automatically when they use one of the live fixtures
(`sandbox`, `sandbox_factory`, `async_sandbox`, `async_sandbox_factory`, `build`,
`async_build`) — see `pytest_collection_modifyitems` in
[`conftest.py`](./conftest.py). A test that calls live APIs without such a
fixture needs an explicit `@pytest.mark.e2e`.

`skip_debug`/`E2B_DEBUG` is a separate axis: it points the SDK at a local envd
instead of a provisioned sandbox and does not enable or disable either tier.

## CI

`SDK Tests` runs the unit tier on every PR. The e2e tier runs in the opt-in
`SDK E2E Tests` workflow — add the `e2e` label to a PR or dispatch it manually.
