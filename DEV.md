# Releasing

To queue a package for the next release, describe the change in a changeset:
`pnpm run changeset`.

## The release pipeline

`Release` (`.github/workflows/release.yml`) is dispatched manually on `main`. It
only does anything when there are pending changesets, and it runs the test suite
of every package a changeset touches before publishing.

`Publish Packages` (`.github/workflows/publish_packages.yml`) then does the work,
in this order:

1. `pnpm run version` — changesets applies the pending changesets: bumps
   `package.json`/`pyproject.toml`, regenerates the changelogs, deletes the
   changeset files.
2. Commits that as `[skip ci] Release new versions`, without pushing it.
3. `pnpm run publish`, via `changesets/action` — uploads to npm (using OIDC
   trusted publishing) and PyPI, tags the release commit **and pushes those
   tags**, and cuts a GitHub release per package with its changelog entry as the
   body.
4. Pushes the branch.

The commit has to come before the publish, because `changeset publish` creates
the release tags from whatever commit it publishes from. Tagging afterwards is
what left every tag pointing at the commit _before_ its own version bump, so that
building from a tag gave you the previous release ([SDK-298]).

Keeping the commit local until then is also deliberate: if the publish fails
before it uploads anything, the branch is untouched and the changesets are still
there, so re-dispatching the workflow retries the whole release cleanly.

Once a package _has_ been uploaded, though, its tag is already on origin — so
step 4 runs even if step 3 then failed, and it merges over anything that landed
on the branch meanwhile. Both matter: a skipped or rebased push would leave those
tags on a commit that is on no branch, and a re-dispatch would publish nothing
(the versions are already on the registry), tag nothing, and still report success.

Tags from `e2b@2.36.1`, `@e2b/cli@2.16.0` and `@e2b/python-sdk@2.35.0` and
earlier are still off by one and are not going to be retagged, because moving
published tags breaks anything that already pinned them. Build those versions
from the npm tarball or the PyPI sdist rather than from the git tag.

## Why the CLI depends on `e2b` with `workspace:^`

For step 2 to be possible, nothing committed there may depend on the artifacts
step 3 uploads. That used to be false: `packages/cli` depended on `e2b` by
registry range, so a release rewrote that range and `pnpm-lock.yaml` had to be
re-resolved against a tarball that did not exist until the publish had run. The
lockfile could only be refreshed afterwards, which forced the commit — and
therefore the tags — after the publish.

`workspace:^` breaks that cycle: the lockfile records `link:../js-sdk` and stops
changing at release time. `pnpm publish` rewrites the range to the concrete
version in the published manifest, so what users install is unchanged.

This also means `e2b` resolves to the workspace SDK everywhere — `tsconfig.json`
and the tsdown bundle already did, and `vitest.config.ts` now has a matching
alias so tests do too, rather than running against the previously released SDK.

### Always pack and publish the CLI with pnpm

Only pnpm resolves the protocol. Bare `npm pack` / `npm publish` put `workspace:^`
straight into the manifest, and installing that fails with `EUNSUPPORTEDPROTOCOL`.
So every flow that packs or publishes the CLI uses pnpm — `pnpm pack` in
`pkg_artifacts.yml`, `pnpm publish` in `publish_candidates.yml`. Reach for the npm
equivalent in a new flow and it will ship an uninstallable CLI.

The `build-cli` action uses `pnpm link --global` for a different reason: it never
packs, so the protocol was never the risk there. `npm install -g <dir>` happened to
work by symlinking without resolving dependencies at all, which is not something to
rely on. Note that `pnpm link --global` requires pnpm's global bin directory to
exist and be on `PATH`; `pnpm/action-setup` arranges that, so the action is coupled
to being set up that way.

The production release goes through `pnpm publish` too, but only indirectly:
`changeset publish` picks its publish tool by detecting the package manager. So the
invariant is checked on the artifact rather than assumed: `pkg_artifacts.yml`
installs the packed CLI tarball with npm on every PR, which fails if any
`workspace:` range survived — npm is both what users install with and the thing that
rejects the protocol.

`packages/cli` also has a `prepack` guard
(`packages/cli/scripts/assert-pnpm-packer.mjs`) that refuses to build a tarball for
any packer but pnpm. That is a local backstop, not the guarantee, and it is worth
knowing what it cannot see: lifecycle scripts do not run under `--ignore-scripts`,
nor for `npm install -g <dir>`, so those paths slip past it entirely. It checks
`npm_execpath` rather than `npm_config_user_agent`, because the latter is inherited
— an npm spawned from pnpm still reports `pnpm/…`, which is exactly what a
tool-detection regression would look like.

### It has to stay a real `dependency`

The CLI bundles the SDK, so it is tempting to demote `e2b` to a devDependency.
Don't: users only get a working CLI if `e2b` is genuinely installed alongside it.
The SDK reaches `undici`, `glob` and `tar` through `dynamicImport`, which is
deliberately opaque to bundlers, so they are resolved from `node_modules` at
runtime rather than inlined. The CLI does not declare them; they arrive through
`e2b`. Without it `e2b template build` loses `glob`/`tar`, and `loadUndici()`
quietly returns `undefined` so every request falls back to the global `fetch`,
giving up H2 and proxy support with no error.

The bundle itself does _not_ depend on this, and it is easy to get backwards:
tsdown externalizes exactly the production dependencies, so listing `e2b` under
`dependencies` is what would make it external — `alwaysBundle` in
`tsdown.config.ts` is there to cancel that and inline it again. A devDependency
would be inlined too. What breaks is only the runtime `node_modules` lookup above.

[SDK-298]: https://linear.app/e2b/issue/SDK-298
