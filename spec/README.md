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

Fetching needs a GitHub token with read access to belt (`GITHUB_TOKEN`, or
being logged in with `gh auth login`).

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

The remaining files (`mcp-server.json`, `envd/buf-*.gen.yaml`,
`remove_extra_tags.py`) are owned by this repository.
