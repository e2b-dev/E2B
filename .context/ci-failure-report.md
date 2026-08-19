# CI/CD Failure Report — `e2b-dev/E2B`

**Window:** 2026-08-11 → 2026-08-18 (7 days)
**Generated:** 2026-08-18
**Source:** `gh run list --limit 300` + `gh run view --log-failed` across all 13 failed runs

## Headline

Not one of the 13 failures in this window was caused by a defect in shipped SDK code. Failures split three ways: **GitHub's own action-download endpoint rate-limiting the repo** (6 runs, all inside a single ~45-minute incident on Aug 17), **the E2B staging backend returning `An internal error occurred.` for template builds** (4 runs, hitting both the JS and Python SDKs), and **one in-progress feature branch that removed a parameter without updating its tests** (2 runs, fixed by the author on the next push).

The single most valuable fix is not a test fix. **Ten jobs across six of the thirteen failed runs died in `Set up job`** before any repository code was checked out, because `codeload.github.com` returned `429`/`503` while fetching third-party action tarballs. `wistia/parse-tool-versions` is referenced 11 times across the workflows and was the most frequent victim.

---

## 1. Overview

| Conclusion                          | Runs   | Share    |
| ----------------------------------- | ------ | -------- |
| Total runs                          | 258    | 100%     |
| Passed (`success`)                  | 160    | 62.0%    |
| **Failed (`failure`)**              | **13** | **5.0%** |
| Action required (`action_required`) | 44     | 17.1%    |
| Skipped                             | 40     | 15.5%    |
| Cancelled                           | 1      | 0.4%     |

The 44 `action_required` runs are **fork PRs waiting on maintainer approval**, not failures, and are excluded from all analysis below. They are spread evenly across the five required workflows (`Generated files`, `Lint`, `SDK Tests`, `Typecheck` — 9 each; `Package Artifacts` — 8), i.e. roughly 9 fork pushes that each fanned out to the full required-check set.

Effective pass rate over runs that actually executed (excluding `action_required`, `skipped`, `cancelled`): **160 / 173 = 92.5%**.

### Failures by day

| Day                     | Failed runs |
| ----------------------- | ----------- |
| 2026-08-12              | 2           |
| 2026-08-13              | 3           |
| 2026-08-14 – 2026-08-16 | 0           |
| **2026-08-17**          | **8**       |

Aug 17 accounts for 62% of the week's failures, and is almost entirely one infrastructure incident plus one branch. See [Failure Patterns](#6-failure-patterns).

### Failures by branch

| Branch                                  | Failed runs | Nature                                  |
| --------------------------------------- | ----------- | --------------------------------------- |
| `cli-access-token-removal`              | 6           | 1 real code error, rest GitHub 429s     |
| `claude/trace-id-error-messages-cbzqwl` | 2           | staging build flake + `uv` download 503 |
| `abuja-v1`                              | 1           | staging template-build flake            |
| `bangui`                                | 1           | sandbox metrics empty                   |
| `iam-sdk-feature`                       | 1           | staging template-build flake            |
| `network-transform-callback`            | 1           | staging template-build flake            |
| `refs/pull/1679/head`                   | 1           | CodeQL, GitHub 429                      |

No failures on `main`. All 6 `Push on main` runs and both `Release` runs passed.

---

## 2. Failures by Workflow

| Workflow                                         | Failed | Total runs | Failure rate |
| ------------------------------------------------ | ------ | ---------- | ------------ |
| **SDK Tests** ← top failing workflow             | **8**  | 35         | **22.9%**    |
| Generated files                                  | 1      | 36         | 2.8%         |
| Lint                                             | 1      | 36         | 2.8%         |
| Typecheck                                        | 1      | 36         | 2.8%         |
| Package Artifacts                                | 1      | 35         | 2.9%         |
| `PR #1679` (CodeQL, code-scanning default setup) | 1      | 5          | 20.0%        |
| Dependabot Changeset                             | 0      | 41         | 0%           |
| Push on main / Release / others                  | 0      | 8          | 0%           |

`SDK Tests` is the top failing workflow by a wide margin — it is the only workflow that talks to real E2B infrastructure, and it fans out across `{Staging, Production} × {ubuntu-22.04, windows-latest} × {JS, Python, CLI}`, so it has the largest surface for both backend flakes and runner-setup flakes.

### Failed jobs in `SDK Tests`

| Run                                                                      | Branch                                  | Failed jobs                                                            | Real test failures?                             |
| ------------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| [`32076518690`](https://github.com/e2b-dev/E2B/actions/runs/32076518690) | `claude/trace-id-error-messages-cbzqwl` | Python (Staging: windows, ubuntu)                                      | Yes — 3 tests                                   |
| [`32041738528`](https://github.com/e2b-dev/E2B/actions/runs/32041738528) | `cli-access-token-removal`              | 8 jobs: Python ×4, JS node ×2, JS cloudflare-deploy, CLI Build windows | Partly — 2 tests × 3 jobs; 4 jobs never started |
| [`32041079531`](https://github.com/e2b-dev/E2B/actions/runs/32041079531) | `cli-access-token-removal`              | CLI Build (Staging, windows)                                           | No — `Set up job` 429                           |
| [`32040704755`](https://github.com/e2b-dev/E2B/actions/runs/32040704755) | `cli-access-token-removal`              | CLI Build (Staging + Production, windows)                              | No — `Set up job` 429/503                       |
| [`31716196066`](https://github.com/e2b-dev/E2B/actions/runs/31716196066) | `abuja-v1`                              | Python (Staging, windows)                                              | Yes — 1 test                                    |
| [`31711822288`](https://github.com/e2b-dev/E2B/actions/runs/31711822288) | `network-transform-callback`            | JS node (Staging, windows)                                             | Yes — 1 test                                    |
| [`31706126715`](https://github.com/e2b-dev/E2B/actions/runs/31706126715) | `iam-sdk-feature`                       | Python (Staging, windows)                                              | Yes — 1 test                                    |
| [`31597672723`](https://github.com/e2b-dev/E2B/actions/runs/31597672723) | `bangui`                                | JS node (Staging, ubuntu)                                              | Yes — 2 tests                                   |

---

## 3. Top Failing Tests (ranked by frequency)

Ranking is by number of distinct failed runs the test appears in. Across the whole week there were only **9 distinct failing tests** and **14 failing test executions** — the failure volume is low; the _repetition_ is what matters.

### 1. `test_build_template_from_base_template` — 2 of 8 failed `SDK Tests` runs (3 of 8 counting the JS twin)

- **File:** `packages/python-sdk/tests/async/template_async/test_build.py::test_build_template_from_base_template`
- **JS equivalent:** `packages/js-sdk/tests/template/build.test.ts > build template from base template`
- **Error:** `e2b.exceptions.BuildException: An internal error occurred. Please try again or contact support with the build ID.`
- **Frequency:** Python — 2/8 runs ([`31716196066`](https://github.com/e2b-dev/E2B/actions/runs/31716196066), [`31706126715`](https://github.com/e2b-dev/E2B/actions/runs/31706126715)), both `Staging / windows-latest`. JS — 1/8 runs ([`31711822288`](https://github.com/e2b-dev/E2B/actions/runs/31711822288)), `Staging / windows-latest`.
- **Verdict:** **Backend flake, not a test or SDK bug.** In every occurrence the build fails 2.3–2.5s in, immediately after the `DEFAULT USER user` layer of the `base` template, with a generic internal error from the staging build API. The SDK is faithfully surfacing a server-side failure; the test has no retry, so a single transient backend hiccup turns a whole PR red. This is the highest-value quarantine/retry candidate in the suite.

```
# Run 31716196066 — Staging / Python SDK - Build and test (windows-latest)
___________________ test_build_template_from_base_template ____________________
[gw3] win32 -- Python 3.10.11

    @pytest.mark.skip_debug()
    async def test_build_template_from_base_template(async_build):
        template = AsyncTemplate().from_template("base")
>       await async_build(template, skip_cache=True, on_build_logs=default_build_logger())

tests\async\template_async\test_build.py:60:
...
E               e2b.exceptions.BuildException: An internal error occurred. Please try again or contact support with the build ID.
e2b\template_async\build_api.py:305: BuildException
---------------------------- Captured stdout call -----------------------------
0.3s  | 15:37:29 INFO  CACHED [base] FROM TEMPLATE base
0.3s  | 15:37:29 INFO  [base] DEFAULT USER user
2.3s  | 15:37:30 ERROR Build failed: An internal error occurred. Please try again or contact support with the build ID.
============ 1 failed, 901 passed, 57 skipped in 276.97s (0:04:36) ============
```

### 2. `test_sync_envd_api_client_wiring` / `test_async_envd_api_client_wiring` — 1 run, 3 jobs, plus blocked the `Typecheck` workflow

- **File:** `packages/python-sdk/tests/test_api_client_transport.py::test_sync_envd_api_client_wiring` (line 205) and `::test_async_envd_api_client_wiring` (line 384)
- **Error:** `TypeError: ConnectionConfig.__init__() got an unexpected keyword argument 'access_token'`
- **Frequency:** 1/8 runs ([`32041738528`](https://github.com/e2b-dev/E2B/actions/runs/32041738528)) but reproduced in **3 separate jobs** — `Staging/ubuntu-22.04`, `Staging/windows-latest`, `Production/windows-latest` — and independently as the sole cause of the `Typecheck` failure ([`32041738226`](https://github.com/e2b-dev/E2B/actions/runs/32041738226)).
- **Verdict:** **Genuine code error, and correctly caught.** Branch `cli-access-token-removal` deleted the `access_token` parameter from `ConnectionConfig.__init__` but left two tests passing `access_token="tok"`. Fully deterministic (identical on every OS and both environments), branch-local — `ConnectionConfig` on `main` still accepts `access_token` — and already fixed: the author's next push at 15:39 UTC passed both `Typecheck` and `SDK Tests`. Notable mainly because `ty` had already flagged it as 2 `unknown-argument` diagnostics; a full ~4-minute test matrix against live infrastructure ran anyway to rediscover the same thing.

```
# Run 32041738528 — Staging / Python SDK - Build and test (ubuntu-22.04)
_______________________ test_sync_envd_api_client_wiring _______________________
[gw1] linux -- Python 3.10.12

    def test_sync_envd_api_client_wiring(test_api_key):
        reset_sync_api_transports()
>       config = ConnectionConfig(api_key=test_api_key, access_token="tok")
E       TypeError: ConnectionConfig.__init__() got an unexpected keyword argument 'access_token'

tests/test_api_client_transport.py:205: TypeError
=========================== short test summary info ============================
FAILED tests/test_api_client_transport.py::test_sync_envd_api_client_wiring - TypeError: ConnectionConfig.__init__() got an unexpected keyword argument 'access_token'
FAILED tests/test_api_client_transport.py::test_async_envd_api_client_wiring - TypeError: ConnectionConfig.__init__() got an unexpected keyword argument 'access_token'
============ 2 failed, 899 passed, 58 skipped in 243.83s (0:04:03) =============
```

And the same defect from the `Typecheck` workflow, where it belongs:

```
# Run 32041738226 — Typecheck / Run typecheck
packages/python-sdk typecheck: error[unknown-argument]: Argument `access_token` does not match any known parameter of bound method `__init__`
packages/python-sdk typecheck:    --> tests/test_api_client_transport.py:205:53
packages/python-sdk typecheck: 205 |     config = ConnectionConfig(api_key=test_api_key, access_token=...)
packages/python-sdk typecheck:     |                                                     ^^^^^^^^^^^^^^^^^^
packages/python-sdk typecheck: info: Method signature here
packages/python-sdk typecheck:    --> e2b/connection_config.py:166:9
packages/python-sdk typecheck: Found 2 diagnostics
packages/python-sdk typecheck: make: *** [Makefile:34: typecheck] Error 1
##[error]Process completed with exit code 2.
```

### 3. `sbx metrics` and `sbx metrics time range` — 1 run, 2 tests

- **File:** `packages/js-sdk/tests/sandbox/metrics.test.ts`
- **Error:** `AssertionError: expected 0 to be greater than 0` (`metrics.length` still empty when the poll loop gave up)
- **Frequency:** 1/8 runs ([`31597672723`](https://github.com/e2b-dev/E2B/actions/runs/31597672723)), `Staging / ubuntu-22.04`. Both tests in the file failed together.
- **Verdict:** **Test-config issue layered on a backend delay.** Both tests poll `getMetrics()` 60 times with a 500 ms wait — a **30-second** ceiling inside a **60-second** `testTimeout`, so they burn only half their budget before asserting (observed durations 35.4s and 35.1s, the extra ~5s being sandbox creation). The staging metrics pipeline simply had not produced a first bucket within 30s. Widening the poll window costs nothing and would likely have absorbed this entirely.

```
# Run 31597672723 — Staging / JS SDK - node (ubuntu-22.04)
 ❯  unit  tests/sandbox/metrics.test.ts (2 tests | 2 failed) 70565ms
   × sbx metrics 35422ms
   × sbx metrics time range 35141ms

 FAIL   unit  tests/sandbox/metrics.test.ts > sbx metrics
AssertionError: expected 0 to be greater than 0
 ❯ tests/sandbox/metrics.test.ts:20:28
     18|     }
     19|
     20|     expect(metrics.length).toBeGreaterThan(0)
       |                            ^
     21|     const metric = metrics[0]
Test Files  1 failed | 96 passed | 1 skipped (98)
      Tests  2 failed | 584 passed | 32 skipped (618)
```

### 4. `test_run_command` (sync **and** async) — 1 run, 2 node ids

- **Files:** `packages/python-sdk/tests/sync/template_sync/methods/test_run_cmd.py::test_run_command` and `packages/python-sdk/tests/async/template_async/methods/test_run_cmd.py::test_run_command`
- **Error:** `e2b.exceptions.BuildException: An internal error occurred.` — same family as #1
- **Frequency:** 1/8 runs ([`32076518690`](https://github.com/e2b-dev/E2B/actions/runs/32076518690)), `Staging / ubuntu-22.04`, both variants in the same job.
- **Verdict:** **Same backend flake as #1, different template.** Both variants failed in the same job within seconds of each other, which points at a short window of staging build-service unavailability rather than anything specific to `run_cmd`. Worth noting the sync/async duplication doubles the apparent failure count for one underlying event.

```
# Run 32076518690 — Staging / Python SDK - Build and test (ubuntu-22.04)
_______________________________ test_run_command _______________________________
[gw0] linux -- Python 3.10.12

    @pytest.mark.skip_debug()
    def test_run_command(build):
        template = Template().from_image("ubuntu:22.04").skip_cache().run_cmd("ls -l")
>       build(template)

tests/sync/template_sync/methods/test_run_cmd.py:10:
...
E               e2b.exceptions.BuildException: An internal error occurred. Please try again or contact support with the build ID.
e2b/template_sync/build_api.py:295: BuildException
FAILED tests/sync/template_sync/methods/test_run_cmd.py::test_run_command - BuildException: An internal error occurred.
FAILED tests/async/template_async/methods/test_run_cmd.py::test_run_command - BuildException: An internal error occurred.
============ 2 failed, 922 passed, 58 skipped in 246.46s (0:04:06) =============
```

### 5. `test_make_symlink_force` — 1 run

- **File:** `packages/python-sdk/tests/async/template_async/methods/test_make_symlink.py::test_make_symlink_force`
- **Error:** `e2b.exceptions.BuildException: An internal error occurred.` — same family as #1
- **Frequency:** 1/8 runs ([`32076518690`](https://github.com/e2b-dev/E2B/actions/runs/32076518690)), `Staging / windows-latest`.
- **Verdict:** **Same backend flake as #1.** Third distinct test in the same run family to be taken out by the same staging build error, on the other OS leg of the same run. Confirms the failure follows the backend, not the test.

```
# Run 32076518690 — Staging / Python SDK - Build and test (windows-latest)
___________________________ test_make_symlink_force ___________________________
[gw2] win32 -- Python 3.10.11

    @pytest.mark.skip_debug()
    async def test_make_symlink_force(async_build):
        ...
>       await async_build(template)

tests\async\template_async\methods\test_make_symlink.py:32:
...
E               e2b.exceptions.BuildException: An internal error occurred. Please try again or contact support with the build ID.
e2b\template_async\build_api.py:305: BuildException
============ 1 failed, 924 passed, 57 skipped in 241.66s (0:04:01) ============
```

---

## 4. Other one-off failures

These are single-occurrence failures that never reached a test assertion. They are listed separately precisely because reading them as test failures would be a misdiagnosis.

### GitHub action-download `429` cascade — 10 jobs across 6 runs, Aug 17 14:55–15:40 UTC

`codeload.github.com` throttled the repo's runners while they pre-fetched composite-action tarballs during `Set up job`. The runner's built-in retry gives up after 3 attempts, so the job goes red before checkout. Affected: `CLI - Build (windows-latest)` in [`32040704755`](https://github.com/e2b-dev/E2B/actions/runs/32040704755) (Staging + Production), [`32041079531`](https://github.com/e2b-dev/E2B/actions/runs/32041079531) and [`32041738528`](https://github.com/e2b-dev/E2B/actions/runs/32041738528); `Lint` [`32041738325`](https://github.com/e2b-dev/E2B/actions/runs/32041738325); `Generated files` [`32041079419`](https://github.com/e2b-dev/E2B/actions/runs/32041079419); `Analyze (javascript-typescript)` in CodeQL run [`32042985513`](https://github.com/e2b-dev/E2B/actions/runs/32042985513); plus `Production / Python SDK - Build and test (ubuntu-22.04)` and both `Staging / JS SDK - node` jobs inside [`32041738528`](https://github.com/e2b-dev/E2B/actions/runs/32041738528).

```
# Run 32041079531 — Staging / CLI Tests / CLI - Build (windows-latest) / Set up job
Download action repository 'wistia/parse-tool-versions@32f568a4...' (SHA:32f568a4...)
##[warning]Failed to download action 'https://codeload.github.com/wistia/parse-tool-versions/zip/32f568a4...'. Error: Response status code does not indicate success: 429 (Too Many Requests).
##[warning]Back off 17.979 seconds before retry.
##[warning]Failed to download action 'https://codeload.github.com/wistia/parse-tool-versions/zip/32f568a4...'. Error: Response status code does not indicate success: 429 (Too Many Requests).
##[warning]Back off 16.044 seconds before retry.
##[error]Response status code does not indicate success: 429 (Too Many Requests).
##[error]Failed to download archive 'https://codeload.github.com/wistia/parse-tool-versions/zip/32f568a4...' after 3 attempts.
```

Different jobs lost on different actions — `wistia/parse-tool-versions`, `pnpm/action-setup`, `astral-sh/setup-uv`, `dorny/paths-filter`, `github/codeql-action@v4` — which confirms a repo-wide throttle rather than one bad action. `503 Service Unavailable` and `502 Bad Gateway` appeared interleaved with the `429`s.

**Verdict:** infrastructure, external, zero signal about any branch. The three `CLI - Build (windows-latest)` failures are the _same_ problem re-run: three pushes to `cli-access-token-removal` landed inside the throttle window. The run at 14:34 before it and the run at 15:39 after it both passed with no CLI code change. Windows legs were hit hardest because `CLI - Build` pulls the largest set of third-party actions.

### `Package Artifacts` — `uv` could not download CPython

Run [`31621321623`](https://github.com/e2b-dev/E2B/actions/runs/31621321623), branch `claude/trace-id-error-messages-cbzqwl`, step `Build Python SDK`.

```
error: Request failed after 3 retries
  Caused by: Failed to download https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.10.19%2B20260203-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz
  Caused by: HTTP status server error (503 Service Unavailable) for url (https://github.com/astral-sh/python-build-standalone/releases/download/20260203/cpython-3.10.19%2B20260203-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz)
##[error]Process completed with exit code 2.
```

**Verdict:** infrastructure/transient. Five later `Package Artifacts` runs on the same branch all passed. Same underlying class as the `429` cascade — an unauthenticated GitHub asset fetch with no durable cache in front of it.

### `JS SDK - cloudflare-deploy` — worker deployed but answered `500 Script not found`

Run [`32041738528`](https://github.com/e2b-dev/E2B/actions/runs/32041738528), `Production / JS SDK - cloudflare-deploy (ubuntu-22.04)`. The build succeeded and `wrangler` reported a successful deploy; the `waitUntilLive` health check in `packages/js-sdk/tests/runtimes/cloudflare-deploy/setup.mts` then threw on the first probe, 232 ms after deploy.

```
Deploying worker to a temporary Cloudflare preview account...
Deployed: https://e2b-js-sdk-smoke.quiver-cayenne.workers.dev
No test files found, exiting with code 1
include: tests/runtimes/cloudflare-deploy/*.test.ts

⎯⎯⎯⎯⎯⎯ Unhandled Error ⎯⎯⎯⎯⎯⎯⎯
Error: Worker at https://e2b-js-sdk-smoke.quiver-cayenne.workers.dev answered 500 ("Script not found | e2b-js-sdk-smoke.quiver-cayenne.workers.dev | Cloudflare") — not the propagation 404: <!DOCTYPE html>
 ❯ waitUntilLive tests/runtimes/cloudflare-deploy/setup.mts:56:15
 ❯ Object.setup tests/runtimes/cloudflare-deploy/setup.mts:101:3
 ❯ TestProject._initializeGlobalSetup .../vitest/dist/chunks/cli-api.BK8pd4xc.js:10746:21
```

**Verdict:** infrastructure, with a small repo-side hardening opportunity. `waitUntilLive` deliberately tolerates only `404` as "route not propagated yet" and fails fast on every other status, but Cloudflare evidently also serves `500 Script not found` for a freshly-deployed-but-unpropagated worker on a brand-new account subdomain. The helper had 240s of budget and used 0.2s of it. The `No test files found` line is a _consequence_ of `globalSetup` aborting collection, not an independent glob bug — `tests/runtimes/cloudflare-deploy/run.test.ts` exists and matches the `include` pattern, and `hasDist` must have been true or the config would have thrown its own `dist/index.mjs not found` error instead.

---

## 5. Cross-SDK Failures

**The template-build flake hits both SDKs, on equivalent tests.** This is the clearest cross-SDK signal in the window and reinforces that the cause is server-side:

|             | JS                                                                                               | Python                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test        | `tests/template/build.test.ts > build template from base template`                               | `tests/async/template_async/test_build.py::test_build_template_from_base_template`                                                                                   |
| Error       | `BuildError: An internal error occurred. Please try again or contact support with the build ID.` | `BuildException: An internal error occurred. Please try again or contact support with the build ID.`                                                                 |
| Thrown from | `src/template/buildApi.ts:391` (`waitForBuildFinish`)                                            | `e2b/template_async/build_api.py:305` (`wait_for_build_finish`)                                                                                                      |
| Failed runs | [`31711822288`](https://github.com/e2b-dev/E2B/actions/runs/31711822288) (Staging/windows)       | [`31716196066`](https://github.com/e2b-dev/E2B/actions/runs/31716196066), [`31706126715`](https://github.com/e2b-dev/E2B/actions/runs/31706126715) (Staging/windows) |

Two independent SDK implementations, on two unrelated feature branches, failing the same scenario with the same server message means any fix must be applied symmetrically — a retry or quarantine added to only one SDK would leave the other still flaking on ~1-in-4 `SDK Tests` runs.

Also cross-cutting, though within one language: the Python `test_run_command` failure reproduced in **both** the sync and async suites in the same run. Any retry policy needs to cover `template_sync` and `template_async` equally, or the sync/async mirroring will keep doubling the noise from a single backend event.

---

## 6. Failure Patterns

### By environment

| Dimension          | Failures                                    | Note                                                                                                                                    |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Staging**        | 8 of 9 job failures that actually ran tests | Every backend flake (template build, metrics) was Staging-only                                                                          |
| **Production**     | 1                                           | The environment-independent `access_token` `TypeError`; separately, one Production job failed on Cloudflare infra without running tests |
| **windows-latest** | 6 of those 9                                | Also took the brunt of the action-download `429`s                                                                                       |
| **ubuntu-22.04**   | 3 of those 9                                |                                                                                                                                         |

Staging carries essentially all of the backend flakiness — expected, but it means a Staging-side incident currently blocks every PR rather than being visibly isolated. The Windows skew in the `429` cascade is an artifact of job ordering and action count (`CLI - Build` on Windows fetches `actions/checkout`, `wistia/parse-tool-versions`, `pnpm/action-setup`, `actions/setup-node`), not a Windows-specific code problem — no repository code was compiled in any of those jobs.

### By root cause (13 failed runs)

| Root cause                                                                                                        | Runs | Share   |
| ----------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| **External infrastructure** — GitHub `codeload` 429/503/502, `python-build-standalone` 503, Cloudflare deploy 500 | 6    | **46%** |
| **E2B backend flake** — staging template-build internal errors, metrics pipeline delay                            | 5    | **38%** |
| **Genuine code error** — `access_token` removed without updating tests (`SDK Tests` + `Typecheck` on one branch)  | 2    | **15%** |

Read at test-execution level rather than run level: of 14 failing test executions, 6 were the deterministic `access_token` error (one defect × 3 jobs × 2 tests), 6 were staging template-build internal errors, and 2 were the metrics assertion. **No SDK product-code regression was caught this week** — the one code failure was a test/implementation mismatch on an in-progress branch, caught correctly and fixed on the next push.

### Cascade and regression notes

- **No test-level cascade.** The heuristic to watch for — one run failing ~15 tests with the same error — did not occur. The maximum failing tests in any single job was **2**, and there were no `429 RateLimitException` failures from the E2B API in any test. (`tests/test_envd_api_exception.py::test_maps_429_to_rate_limit` passed everywhere.)
- **One job-level cascade.** [`32041738528`](https://github.com/e2b-dev/E2B/actions/runs/32041738528) is the week's worst-looking run — 8 failed jobs — but 4 of those never started, killed by the `codeload` `429` wave. Counting it as 8 problems overstates it by 4; it is one real defect plus one external incident.
- **No `pytest-timeout` failures at all.** Grepping every Python log for `Failed: Timeout (>Ns) from pytest-timeout` found only the `pytest-timeout==2.4.0` install lines. So neither the `Timeout (>10s)` test-config category nor the `Timeout (>180s)` backend-hang category appeared this week. The one timeout-shaped failure is the JS metrics test, which is a self-imposed 30s poll ceiling rather than a harness timeout.
- **No long-standing regression.** The Aug 17 spike (8 of 13 failures) is a same-day infrastructure incident plus one branch, not a trend: Aug 14–16 had zero failures, and the last push to `main` and both releases passed. Nothing is currently broken on `main`.
- **The recurring item to watch** is the staging template-build internal error, which appeared on **four separate days' branches** (Aug 12, 13, 13, 17) across both SDKs. It is the only failure mode with genuine multi-run, multi-branch, multi-language persistence.

---

## 7. Recommendations

1. **Stop fetching third-party action tarballs on every job — this is 46% of the week's failures.** `wistia/parse-tool-versions` is referenced 11 times across `.github/workflows/` and was the most frequent `429` victim. `.tool-versions` is five lines of `name version`; replacing the action with a local composite action under `.github/actions/` (or a few lines of shell writing to `$GITHUB_OUTPUT`) removes one external download from nearly every job in the repo. Applying the same treatment to `pnpm/action-setup` (Corepack can pin pnpm from `.tool-versions` directly) shrinks the blast radius further. The runner's 3-attempt fetch retry is not configurable, so reducing the number of fetches is the only lever available inside the workflow YAML.

2. **Add bounded retries to the template-build tests in both SDKs.** `BuildException`/`BuildError: An internal error occurred.` took out 4 of 8 `SDK Tests` failures on four different branches. Retry once or twice on that specific server-side message — `retry: 2` on the affected vitest tests and `pytest-rerunfailures` (or an explicit retry in the `build` / `async_build` fixtures in `tests/conftest.py`) on the Python side. Per the repo convention, apply this to the JS suite **and** both the sync and async Python suites, or the sync/async mirroring will keep double-counting each backend hiccup. Retrying only a known transient backend message keeps real build regressions failing loudly.

3. **Widen the metrics poll window in `packages/js-sdk/tests/sandbox/metrics.test.ts`.** Both tests poll 60 × 500 ms = 30s inside a 60s `testTimeout`, leaving half the budget unused; the staging metrics pipeline needed longer than 30s. Raise the loop to use most of the available budget (e.g. ~110 iterations, or a deadline-based loop at ~50s) and consider matching the Python equivalents. Free reliability with no loss of coverage.

4. **Treat Cloudflare's `500 Script not found` as a retryable propagation state in `waitUntilLive`.** `packages/js-sdk/tests/runtimes/cloudflare-deploy/setup.mts:56` tolerates only `404` while waiting for the workers.dev route, then fails fast on everything else — so it aborted after 0.2s of a 240s budget when Cloudflare returned `500` with the `Script not found` error page for a worker it had just accepted. Add `500` with that title to the tolerated-while-waiting set, keeping the fail-fast behaviour for genuinely unexpected statuses.

5. **Gate the expensive `SDK Tests` matrix on `Typecheck` passing.** The `access_token` defect was already reported by `ty` as 2 `unknown-argument` diagnostics, yet the full `{Staging, Production} × {ubuntu, windows}` matrix still spent ~4 minutes per job against live E2B infrastructure to rediscover it in three jobs. Making `SDK Tests` depend on `Typecheck` (or running typecheck as a fast pre-step) would have turned three noisy live-infra failures into one cheap, unambiguous signal — and would reduce concurrent job count, which is itself what triggers the `codeload` throttling in recommendation 1.

### Not recommended

- **Do not quarantine or "fix" any individual test from section 3 in isolation.** Eight of the nine distinct failing tests were reporting a real external fault correctly. Only the metrics poll window is genuinely a test-side defect.
- **Do not act on the `Lint` or `Generated files` failures as code problems.** Both died in `Set up job` on `codeload` `429`s before ESLint/Ruff or the codegen diff ever ran. Branch history confirms it: `Lint` passed at 14:34, 14:55, 15:02 and 15:39 and failed only at 15:15; `Generated files` passed at 14:55, 15:15 and 15:39 and failed only at 15:02. Attributing either to `cli-access-token-removal` would be a misdiagnosis.
