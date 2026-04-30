Use pnpm for node and poetry for python to install and update dependencies.
Run `pnpm run format`, `pnpm run lint` and `pnpm run typecheck` before committing changes.
To re-generate the API client run `make codegen` in the repository root.
Run tests on affected codepaths using `pnpm run test`.
Generate changesets after updating packages/cli, packages/js-sdk, packages/python-sdk.
Default credentials are stored in .env.local in the repository root or inside ~/.e2b/config.json.
