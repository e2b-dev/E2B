---
name: testing-python-sdk
description: "Run tests for the E2B Python SDK (packages/python-sdk). Use when running its pytest suites (sync or async) or verifying SDK behavior against real sandboxes."
---

# Testing the Python SDK

All commands run in `packages/python-sdk`. Use uv for everything (`uv run ...`); never pip.

## Layout

- `tests/sync/` and `tests/async/` — integration tests against real sandboxes (need `E2B_API_KEY`). Sync and async variants must stay equivalent.
- `tests/test_*.py` (top level) — offline unit tests (transports, codecs, config parsing, etc.).
- `tests/conftest.py` — fixtures that create/clean up sandboxes; `pytest.ini` sets `asyncio_mode=auto`, a 30s per-test timeout, and `pythonpath = tests` for shared helpers like `envd_frame_server`.

## Running

```bash
# full suite, 4 workers (needs E2B_API_KEY in env)
pnpm run test            # == uv run pytest -n 4 --verbose -x

# single file / test — preferred while iterating
uv run pytest tests/test_paginator.py -v
uv run pytest tests/sync/sandbox_sync/test_create.py -v -k "metadata"

# offline-only quick check (skip integration dirs)
uv run pytest tests --ignore=tests/sync --ignore=tests/async -q
```

The `skip_debug` marker skips a test when `E2B_DEBUG` is set (local envd).

## CI notes

- Integration jobs run against both **production and staging**; staging jobs are known to flake (template-build 500s, transient backend errors). Check the base branch or rerun before blaming your change.
- New API parameters often reach staging before production — a production-only failure of a new-feature test usually means the API isn't deployed there yet.
- `tests/shared/` holds offline suites shared between sync and async (request shaping, encoding, proxy config) — the fastest signal when no key is available.
