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
   trusted publishing) and PyPI, tags the release commit, and cuts a GitHub
   release per package with its changelog entry as the body.
4. Pushes the branch.

The commit has to come before the publish, because `changeset publish` creates
the release tags from whatever commit it publishes from. Tagging afterwards is
what left every tag pointing at the commit _before_ its own version bump, so that
building from a tag gave you the previous release ([SDK-298]).

Keeping the commit local until the publish succeeds is also deliberate: if the
upload fails, the branch is untouched and the changesets are still there, so
re-dispatching the workflow retries the whole release cleanly.

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

### It has to stay a real `dependency`

The CLI bundles the SDK, so it is tempting to demote `e2b` to a devDependency.
Don't — it is load-bearing twice over:

- `tsdown.config.ts` derives `alwaysBundle` from `dependencies`. Drop `e2b` from
  there and it becomes external instead, so the CLI ships a bare `require("e2b")`
  and dies on startup.
- The SDK reaches `undici`, `glob` and `tar` through `dynamicImport`, which is
  deliberately opaque to bundlers, so they are resolved from `node_modules` at
  runtime rather than inlined. The CLI does not declare them; they arrive through
  `e2b`. Without it `e2b template build` loses `glob`/`tar`, and `loadUndici()`
  quietly returns `undefined` so every request falls back to the global `fetch`,
  giving up H2 and proxy support with no error.

[SDK-298]: https://linear.app/e2b/issue/SDK-298
