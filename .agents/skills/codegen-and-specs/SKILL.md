---
name: codegen-and-specs
description: "Update API specs and regenerate SDK/CLI client code in the E2B repo. Use when bumping spec refs, adding new API surface, or when the generated-files CI check fails."
---

# Codegen and Specs

## Ownership: never hand-edit `spec/`

Files under `spec/` are synced from upstream repos and any manual edit will be overwritten:

- `spec/openapi.yml`, envd specs → `e2b-dev/infra`
- `spec/volume-api.yml` → `e2b-dev/belt`

Copybara (`copy.bara.sky`) mirrors them in; `spec/infra-ref` and `spec/belt-ref` pin the upstream commits used by codegen. `spec/README.md` is the authoritative doc.

## Updating generated code

```bash
# 1. bump the pin (or let copybara have updated the spec already)
echo <new-commit-sha> > spec/infra-ref     # or spec/belt-ref

# 2. refetch pinned specs + regenerate everything in Docker
make codegen
```

`make codegen` builds `codegen.Dockerfile` and runs `make generate` inside it, so results don't depend on local tool versions. Fetch failures only warn and fall back to the tracked copies — check the output if you expected a spec change. Belt spec fetches need a token; public infra specs fetch anonymously.

Fetch-only helpers: `pnpm fetch:api-spec`, `pnpm fetch:envd-spec`, `pnpm fetch:volume-spec` (override the pin with `E2B_INFRA_REF=main` / `E2B_BELT_REF=main`).

## What gets generated

Redocly first filters the OpenAPI specs by SDK tags (internal/`x-internal` ops are stripped), then clients are generated into `packages/js-sdk`, `packages/python-sdk`, and the CLI. Commit the generated diffs together with the spec/ref change.

## CI

`generated_files.yml` re-runs generation on PRs touching `spec/**`, codegen Dockerfiles, `copy.bara.sky`, redocly config, fetch scripts, packages, or lockfiles, and fails if the committed generated files are stale. If it fails, run `make codegen` locally and commit the diff — don't patch generated files by hand.

Gotcha from past sessions: a new API parameter appearing in the staging spec may not be deployed to production yet — generated code can be ahead of the production API (see `debugging-ci`).
