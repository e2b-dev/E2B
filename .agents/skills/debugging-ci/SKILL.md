---
name: debugging-ci
description: "Understand and debug GitHub Actions failures on E2B pull requests: the workflow matrix, which checks are required, and known flaky jobs. Use whenever a PR check fails."
---

# Debugging CI

## The matrix (`.github/workflows/sdk_tests.yml`)

A paths filter decides which suites run (docs-only `.md` changes trigger nothing; `spec/**`, lockfiles, `.tool-versions`, or the workflow files trigger everything):

- **Production** JS / Python / CLI test suites — these feed the required aggregate check **`SDK Tests Status`**, which also fails if change-detection itself fails or jobs are cancelled.
- **Staging** JS / Python / CLI suites — same reusable workflows against `E2B_DOMAIN_STAGING`; staging JS runs `node-only` (Bun/Deno/Cloudflare coverage only runs on production).
- `generated_files.yml` — fails when committed generated code is stale; fix with `make codegen` (see `codegen-and-specs`).

The JS workflow's full production matrix covers Node (Ubuntu + Windows), Bun, Deno, Cloudflare, and a Cloudflare deploy leg.

## Known flakes and skew (from past sessions)

- **Staging jobs flake**: template-build HTTP 500s, network-egress curl failures, other transient backend errors. Before blaming your change, check whether the same job fails on the base branch, or rerun the job.
- **Staging-before-production skew**: new API features usually reach staging first. A *production-only* failure of a test exercising a brand-new API parameter typically means the API isn't deployed to production yet, not an SDK bug.
- **Cloudflare deploy** can hit propagation / read-after-write races on freshly created preview workers — treat an isolated intermittent failure there as advisory and rerun.

## Debug loop

1. Get the failing job and its logs (Devin: `git_pr_checks` → `git_ci_job_logs` with the job id).
2. Reproduce locally with the same command the job runs (the reusable workflows run `pnpm run test` / `uv run pytest` in the package dir; export `E2B_DOMAIN` to mimic staging).
3. If it's a live-sandbox test, remember it needs `E2B_API_KEY`; offline mock suites are the fastest local signal.
4. Never conclude a failure is preexisting/flaky without evidence — verify against the base branch or a rerun.
