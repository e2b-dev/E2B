---
name: building-templates
description: "Build E2B sandbox templates: the CLI Dockerfile flow, the Template SDK builder, and the repo's own prepared templates. Use when creating/rebuilding templates or debugging template builds."
---

# Building Templates

Two ways to define a template:

## 1. CLI Dockerfile flow

`e2b template create <name>` reads `e2b.Dockerfile` (or `Dockerfile`) in the working directory (or `-p <path>`) and builds it into a sandbox template. Useful flags: `-c/--cmd` (start command), `--ready-cmd` (must exit 0 before the template is considered ready — doubles as a build-time smoke test), `--cpu-count`, `--memory-mb` (even number, default 1024), `--no-cache`. Needs `E2B_API_KEY`. Related: `template list`, `template delete`, `template publish/unpublish`, and `template migrate` (converts a legacy `e2b.Dockerfile` + `e2b.toml` pair to the Template SDK format).

## 2. Template SDK (js-sdk)

Programmatic builder: `Template().fromPythonImage('3')...` then `Template.build(template, 'name:tag', {...})` (see `packages/js-sdk/src/template/`, examples in the `Template` class jsdoc). Live examples of usage — including file-context handling and `defaultBuildLogger` — are in `packages/js-sdk/tests/template/` (run via the `template` vitest project, 180s timeout, needs `E2B_API_KEY`).

## Repo's prepared templates (`templates/`)

- `templates/base` — the default public template; also pushed to DockerHub.
- `templates/httpbin` — private echo-server sidecar used by the JS network-transform tests; built with `--cmd 'go-httpbin ...'` and a curl `--ready-cmd`.

They are rebuilt via the manual `Build and push prepared templates` workflow (`.github/workflows/templates.yml`, `workflow_dispatch` with a template picker). Locally the same commands work, e.g.:

```bash
cd templates/base && e2b template create base --memory-mb 512
```

## Debugging build failures

- Build logs stream from the API; HTTP 500s during template builds are a known transient on staging — retry before digging.
- If the build hangs at "ready", the `--ready-cmd` never exited 0 — run it inside a sandbox of the base image to check.
- The build runs remotely; local Docker is not used for `e2b template create`.

## Devin Secrets Needed
- `E2B_API_KEY`
