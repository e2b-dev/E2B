# API specs

Most files in this directory are owned by other repositories and are synced
here with [Copybara](https://github.com/google/copybara) (config in
`../copy.bara.sky`) — **don't edit them by hand**; change them in their
source repository and re-sync:

- `openapi.yml`, `envd/envd.yaml`, `envd/filesystem/`, `envd/process/` are
  owned by the [infra repository](https://github.com/e2b-dev/infra), pinned
  by `infra-ref`.
- `openapi-volumecontent.yml` is owned by the private belt repository,
  pinned by `belt-ref`.

Fetches authenticate with a GitHub token when available (`GITHUB_TOKEN`, or
being logged in with `gh auth login`); the public infra specs also fetch
anonymously, while the volume-content spec needs a token with read access
to belt. When a fetch fails, `make codegen` warns and falls back to the
tracked copy.

`make codegen` re-fetches all of them at their pinned commits before
generating the clients, and the generated-files CI check fails if the
tracked copies don't match the pins. The files are stored byte-identical to
upstream. To update the specs, point the pin at a newer commit and re-run
`make codegen`. To fetch without regenerating:

```sh
pnpm fetch:api-spec     # openapi.yml
pnpm fetch:envd-spec    # envd spec
pnpm fetch:volume-spec  # openapi-volumecontent.yml
E2B_INFRA_REF=main pnpm fetch:api-spec     # try the latest without moving the pin
E2B_BELT_REF=main pnpm fetch:volume-spec
```

`mcp-server.json` describes the MCP servers a sandbox can run and is
generated from [Docker's MCP catalog](https://hub.docker.com/mcp) — **don't
edit it by hand**, refresh it from the catalog instead:

```sh
pnpm generate:mcp-spec  # spec/mcp-server.json, then the SDK types
```

Unlike the pinned specs above, this one tracks whatever the catalog publishes
today, so `make codegen` leaves it alone and refreshing it is a deliberate
step. Expect servers to appear, disappear, and change their configuration
between refreshes.

`envd/buf-*.gen.yaml` is owned by this repository. The SDK generate pipelines
filter `openapi.yml` down to the tags each SDK exposes with Redocly CLI (see
`../redocly.yaml`) before generating the clients.
