Use pnpm for node and uv for python to install and update dependencies.
Run `pnpm run format`, `pnpm run lint` and `pnpm run typecheck` before committing changes.
When modifying the SDK packages, ensure equivalent changes are applied to both JS as well as sync and async Python implementations.
Design the SDK in accordance with the design principles in TASTE.md.
Never edit the API, envd, or volume-content specs in spec/ by hand; they are synced with Copybara from e2b-dev/runtime and e2b-dev/belt at the commits pinned in spec/runtime-ref and spec/belt-ref (see copy.bara.sky and spec/README.md). To update the specs, bump the pins and re-run `make codegen`, which re-fetches them before generating.
Create or update tests covering affected codepaths and run them using `pnpm run test`.
Generate a changeset with `pnpm changeset` in the repository root when changing the public surface of packages/cli, packages/js-sdk, or packages/python-sdk; internal scripts, devtools, and tests don't need one.
When creating a pull request, add usage examples for user-facing changes to the PR description.
When opening a new pull request, use the Linear MCP if available to link to related issues, or create a new issue from the PR description.
Keep PR descriptions up-to-date with changes.
Default credentials are stored in .env.local in the repository root or inside ~/.e2b/config.json.

## Cloud Agent environment

Toolchain pins are in `.tool-versions`. Root `pnpm install --frozen-lockfile` installs the JavaScript workspace only. Python packages are separate uv projects; sync each one with `uv sync --locked --python 3.10` in `packages/python-sdk`, `packages/code-interpreter-python`, and `packages/desktop-python`.

Node must be 22.18 or newer. `.npmrc` sets `engine-strict`, and `tsdown` rejects older 22.x releases. Bun 1.3.14 and Deno 2.8.1 are used by the JavaScript SDK's extra runtime test scripts.

Live sandbox examples and most SDK tests call the E2B API and need `E2B_API_KEY`. `make codegen` needs Docker and is only for regenerating clients after a spec pin bump.
