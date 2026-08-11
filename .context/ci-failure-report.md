# CI failure report: 2026-08-04 through 2026-08-11

Context: GitHub Actions runs for `e2b-dev/E2B` created between 2026-08-04 00:00 UTC and 2026-08-11, using `main` as the repository baseline. `action_required` runs are counted in the overview but ignored in failure analysis.

## Overview

- Total completed runs collected: 350
- Passed: 268
- Failed: 42
- Skipped: 35
- Action required: 5, ignored below
- Failed-job excerpts inspected: 103 failed jobs from the 42 failed runs

## Failures by workflow

| Workflow | Failed runs | Notes |
| --- | ---: | --- |
| SDK Tests | 24 | Dominated by Python template build timeouts/crashes, plus a recent JS `caBundle` regression on non-Node runtimes and a few infra/service flakes. |
| Dependabot npm/yarn update workflows | 4 | Dependabot updater failed while applying npm/yarn security updates. |
| Generated files | 4 | Mostly part of pnpm engine or GitHub Actions service cascades. |
| Lint | 4 | Mostly part of pnpm engine or GitHub Actions service cascades. |
| Package Artifacts | 3 | Mostly part of pnpm engine or GitHub Actions service cascades. |
| Typecheck | 3 | Mostly part of pnpm engine or GitHub Actions service cascades. |

## Top failing tests

### 1. `tests/async/template_async/test_build.py::test_build_template_with_skip_cache`

- Frequency: 10 failed runs, 26 failed matrix jobs.
- Environments: Python SDK, staging and production, Ubuntu and Windows.
- Error summary: Ubuntu jobs hit `pytest-timeout` after 180 seconds; Windows jobs usually report an xdist worker crash while running the same test.
- Verdict: likely template build backend or template cache/skip-cache path instability, not an OS-specific SDK client bug. The same test failed across multiple pyqwest migration branches on 2026-08-04, then reappeared on 2026-08-10 in the TLS branch.
- Log snippet, run `31422911844`:

```text
2026-08-10T19:20:22.1354391Z E           Failed: Timeout (>180.0s) from pytest-timeout.
2026-08-10T19:20:22.1368324Z FAILED tests/async/template_async/test_build.py::test_build_template_with_skip_cache - Failed: Timeout (>180.0s) from pytest-timeout.
```

### 2. `tests/sync/template_sync/test_build.py::test_build_template`

- Frequency: 4 failed runs, 5 failed matrix jobs.
- Environments: Python SDK, mostly staging Windows, with one Ubuntu internal build error.
- Error summary: worker crashes on Windows and `BuildException: An internal error occurred` on Ubuntu.
- Verdict: probably the same template build backend instability as the async skip-cache test, but this path only started showing up in the 2026-08-10 TLS runs, so treat it as a recent regression candidate.
- Log snippet, run `31422878146`:

```text
2026-08-10T19:19:55.4484694Z worker 'gw3' crashed while running 'tests/async/template_async/test_build.py::test_build_template'
2026-08-10T19:19:55.4486268Z worker 'gw1' crashed while running 'tests/sync/template_sync/test_build.py::test_build_template'
```

### 3. `tests/async/template_async/test_build.py::test_build_template`

- Frequency: 2 failed runs, 2 failed matrix jobs.
- Environments: Python SDK, staging Windows.
- Error summary: xdist worker crash while running the async template build test.
- Verdict: likely another manifestation of the Python template build hang/crash family rather than an independent assertion failure.
- Log snippet, run `31422911844`:

```text
2026-08-10T19:20:35.4535685Z worker 'gw3' crashed while running 'tests/async/template_async/test_build.py::test_build_template'
2026-08-10T19:20:35.4541354Z FAILED tests/async/template_async/test_build.py::test_build_template - worker 'gw3' crashed while running 'tests/async/template_async/test_build.py::test_build_template'
```

### 4. `tests/async/template_async/test_build.py::test_build_template_from_base_template`

- Frequency: 2 failed runs, 2 failed matrix jobs.
- Environments: Python SDK, staging Windows.
- Error summary: backend returned `BuildException: An internal error occurred. Please try again or contact support with the build ID.`
- Verdict: backend build service failure, distinct from short `pytest-timeout` output because the test returns an explicit internal build error.
- Log snippet, run `31422625847`:

```text
2026-08-10T19:15:42.4723044Z E               e2b.exceptions.BuildException: An internal error occurred. Please try again or contact support with the build ID.
2026-08-10T19:15:42.4736040Z FAILED tests/async/template_async/test_build.py::test_build_template_from_base_template - e2b.exceptions.BuildException: An internal error occurred.
```

### 5. One-run Python SDK failures

- `tests/sync/template_sync/test_build.py::test_build_template_from_base_template`, run `31480015745`: backend internal build error on 2026-08-11, worth flagging as a very recent template-build regression signal.
- `tests/test_api_client_transport.py::test_async_api_client_serves_concurrent_requests`, run `31394890975`: Windows local transport failure, `pyqwest.WriteError`/`httpx.WriteError` against `127.0.0.1`, likely branch-specific to the pyqwest transport migration.
- `tests/sync/sandbox_sync/test_network.py::test_deny_specific_ip`, run `31413986779`: command exited with code 35, likely network-policy/curl flake.
- `tests/async/sandbox_async/test_network.py::test_allow_specific_ip_with_deny_all`, run `31420875484`: command exited with code 18, likely network-policy/curl flake.

## Other one-off failures worth mentioning

- pnpm engine cascades: two Dependabot branch waves on 2026-08-04 and 2026-08-07 failed Generated files, Lint, Package Artifacts, Typecheck, CLI, JS SDK, and some SDK jobs with `ERR_PNPM_UNSUPPORTED_ENGINE`. Treat each wave as one infrastructure/config event rather than many independent product failures.
- GitHub Actions service outage: 2026-08-06 `pin-actions-to-sha` runs failed resolving `actions/cache@v4` and `actions/checkout@v4` with `Service Unavailable`. Treat as one Actions availability event.
- Dependabot update failures: four npm/yarn updater workflows on `main` failed before opening/updating dependency PRs. The useful snippet is `Dependabot encountered an error performing the update`; these are separate from repo test failures.
- JS non-Node `caBundle` behavior: four 2026-08-10 SDK runs on `python-sdk-honor-custom-tls-trust-verify_ssl-ca-bundle-on-sdk-320` failed bun, deno, and Cloudflare jobs with ``Error: `caBundle` is only supported on Node``. This looks like a real expectation/API compatibility issue, not infra.
- Cloudflare deploy smoke: two runs in the same TLS branch returned 500 `Script not found` from `e2b-js-sdk-smoke.*.workers.dev`, likely deploy propagation or cleanup ordering.
- JS node timeout: two staging JS node jobs timed out after 180000 ms on the TLS branch. These resemble short test-level timeouts, not the Python backend hangs with pytest-timeout stack dumps.

## Cross-SDK notes

- The 2026-08-10 TLS branch failed both JS and Python SDK jobs. JS failures were deterministic runtime-support assertions for `caBundle` in bun/deno/Cloudflare, while Python failures were template build timeouts or internal backend build errors. Do not collapse these into one SDK bug, but they should be reviewed together because the branch changed trust/transport behavior across SDKs.
- Template build failures are currently Python-only in the captured logs. JS SDK failures in the same runs were timeout/runtime/deploy failures, not the same template test names.
- The pnpm engine cascade affected CLI, JS SDK, generated-files, lint, package, and typecheck jobs together; it should be treated as one toolchain compatibility event.

## Failure patterns by environment and root cause

- Python template build backend instability: 10 runs for `test_build_template_with_skip_cache`, plus related sync/async template build failures. Ubuntu shows explicit `pytest-timeout` at 180 seconds; Windows tends to show worker crashes, which is probably the same long-running/hung operation surfacing through xdist differently.
- Backend internal build errors: template-from-base and plain template build tests returned `BuildException: An internal error occurred`, distinct from timeout failures because the backend responded with a build failure.
- Windows-specific transport/network flakes: local pyqwest/httpx transport write error and two sandbox network tests failed only in Windows jobs in the inspected excerpts.
- JS runtime compatibility: bun, deno, and Cloudflare failed on `caBundle` support expectations; Node jobs did not show that same assertion.
- GitHub/CI infrastructure: pnpm engine mismatch and GitHub Actions service-unavailable waves created broad matrix failures that should be counted as cascades.

## Recommendations

1. Add targeted observability around template build start, cache/skip-cache decisions, backend build IDs, and final states, then attach build IDs to pytest failure output so `test_build_template_with_skip_cache` can be tied to backend logs.
2. Quarantine or split the Python template build tests by backend dependency and increase diagnostics before increasing timeouts; the current 180-second pytest-timeout is short-test protection, while worker crashes suggest backend hangs or hard process termination.
3. Fix the JS `caBundle` contract on non-Node runtimes: either skip/guard unsupported runtimes in tests or document and assert the expected runtime-specific error in a dedicated compatibility test.
4. Update Dependabot/toolchain configuration so npm/yarn updater branches use the repository-pinned Node/pnpm versions before Generated files, Lint, Package Artifacts, Typecheck, and SDK Tests run.
5. Add CI grouping labels or post-processing for known cascades such as GitHub Actions service availability and pnpm engine mismatch so weekly failure reports do not inflate one root cause into many failures.
