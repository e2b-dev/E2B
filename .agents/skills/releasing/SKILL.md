---
name: releasing
description: "How versioning and releases work in the E2B repo: changesets, the manual release workflow, and release candidates. Use when preparing a release, deciding whether a PR needs a changeset, or debugging the publish pipeline."
---

# Releasing

## Changesets

Versions are driven by changesets in `.changeset/`. Generate one with `pnpm changeset` at the repo root **when a PR changes the public surface** of `packages/cli` (`@e2b/cli`), `packages/js-sdk` (`e2b`), or `packages/python-sdk` (`@e2b/python-sdk`). Internal scripts, devtools, tests, docs, and skills don't need one. The python package participates in changesets via its npm-shim name `@e2b/python-sdk`.

## Production release (`.github/workflows/release.yml`)

Manual `workflow_dispatch`, and it hard-fails on any ref other than `main` (a feature branch carrying changesets would otherwise publish real packages). Flow:

1. **Preflight** — parses `.tool-versions` for pinned tooling, runs `is_release.sh` / `is_release_for_package.sh` to decide which of js-sdk / python-sdk / cli have pending changesets, and builds a Slack "itinerary" (advisory only — `continue-on-error`).
2. **Tests** — the full JS / Python / CLI suites run for each package being released.
3. **Publish** (`publish_packages.yml`) — versions via changesets, publishes to npm and PyPI (needs `E2B_API_KEY`, `PYPI_TOKEN`), and pushes the version-bump commit.

Production and candidate runs on the same ref share a concurrency group, so they serialize.

## Release candidates (`release-candidate.yml`)

Manual dispatch from any branch with per-package booleans, a dist-tag (`rc`/`beta`/`snapshot`), an optional preid (defaults to the branch name), and an optional skip-tests flag. Publishes prerelease versions via `publish_candidates.yml` without touching main. Use this to let users try an unmerged fix.

## Debugging a failed release

- Failure Slack notifications fire from the workflow; check which stage failed (preflight vs tests vs publish).
- Test-stage failures are the normal SDK suites — see `debugging-ci`.
- "Nothing to release" means no pending changesets — check `pnpm changeset status`.
