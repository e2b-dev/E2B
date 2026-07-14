Use pnpm for node and uv for python to install and update dependencies.
Run `pnpm run format`, `pnpm run lint` and `pnpm run typecheck` before committing changes.
When modifying the SDK packages, ensure equivalent changes are applied to both JS as well as sync and async Python implementations.
To re-generate the API client run `make codegen` in the repository root when modifying spec/.
Create or update tests covering affected codepaths and run them using `pnpm run test`.
Generate a changeset when updating packages/cli, packages/js-sdk, packages/python-sdk with `pnpm changeset` in the repository root.
When creating a pull request, add usage examples for user-facing changes to the PR description.
Keep PR descriptions up-to-date with changes.
Default credentials are stored in .env.local in the repository root or inside ~/.e2b/config.json.
