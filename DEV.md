# Releasing

To queue a package for the next release, describe the change in a changeset:
`pnpm run changeset`.

## The release pipeline

`Release` (`.github/workflows/release.yml`) is dispatched manually on `main`. It only
does anything when there are pending changesets, and it runs the test suite of every
package a changeset touches before publishing.

`Publish Packages` (`.github/workflows/publish_packages.yml`) then, in this order:

1. `pnpm run version` — changesets bumps `package.json`/`pyproject.toml`, regenerates
   the changelogs and deletes the changeset files.
2. Commits that as `[skip ci] Release new versions`, without pushing it.
3. `pnpm run publish`, via `changesets/action` — uploads to npm and PyPI, tags the
   release commit and pushes those tags, and cuts a GitHub release per package.
4. Pushes the branch.

The commit has to come before the publish, because `changeset publish` tags whatever
commit it publishes from. Tagging afterwards is what left every tag pointing at the
commit _before_ its own version bump, so building from a tag gave you the previous
release ([SDK-298]).

Step 4 is gated on tags existing at `HEAD`, not on the publish succeeding: once a tag
is on origin the commit under it has to be on the branch too. If the branch moved
meanwhile it merges rather than rebases, since rebasing would strand those tags.

Tags from `e2b@2.36.1`, `@e2b/cli@2.16.0` and `@e2b/python-sdk@2.35.0` and earlier are
still off by one and will not be retagged, because moving published tags breaks
anything that pinned them. Build those versions from the npm tarball or the PyPI
sdist rather than from the git tag.

## Why the CLI depends on `e2b` with `workspace:^`

For step 2 to be possible, nothing committed there may depend on the artifacts step 3
uploads. That used to be false: `packages/cli` depended on `e2b` by registry range, so
a release rewrote that range and `pnpm-lock.yaml` had to be re-resolved against a
tarball that did not exist until the publish had run — which forced the commit, and
therefore the tags, after it.

`workspace:^` breaks that cycle: the lockfile records `link:../js-sdk` and stops
changing at release time. `pnpm publish` rewrites the range to a concrete version, so
what users install is unchanged.

Two consequences worth knowing:

- **Pack and publish the CLI with pnpm.** Only pnpm resolves the protocol; `npm pack`
  writes `workspace:^` into the tarball verbatim and installing that fails with
  `EUNSUPPORTEDPROTOCOL`. `pkg_artifacts.yml` installs the packed tarball with npm on
  every PR, so a regression fails there rather than on users.
- **`e2b` has to stay a real `dependency`.** The SDK reaches `undici`, `glob` and
  `tar` through `dynamicImport`, which is deliberately opaque to bundlers, so they
  resolve from `node_modules` at runtime. The CLI declares none of them and gets all
  three through `e2b`. Without it `e2b template build` loses `glob`/`tar` and
  `loadUndici()` quietly returns `undefined`, downgrading every request to the global
  `fetch`. (The bundle itself does not depend on this — tsdown externalizes production
  dependencies, so `alwaysBundle` in `tsdown.config.ts` is what inlines the SDK, and a
  devDependency would be inlined too.)

[SDK-298]: https://linear.app/e2b/issue/SDK-298
