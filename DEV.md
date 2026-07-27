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
2. `pnpm run publish`, via `changesets/action` — uploads to npm (using OIDC
   trusted publishing) and PyPI. `changeset publish` also creates the release tags
   locally; `createGithubReleases: false` is what stops the action from pushing
   them here.
3. `pnpm i` — refreshes `pnpm-lock.yaml` against the versions just published.
   The npm registry is eventually consistent, so this retries with backoff.
4. Commits everything as `[skip ci] Release new versions` and pushes it.
5. Moves the tags from step 2 onto the release commit, pushes them, and cuts a
   GitHub release per package with its changelog entry as the body.

Steps 4 and 5 are in that order on purpose. The published artifacts have to be
built before the lockfile can name them, so the release commit can only exist
after the upload — which means the tags have to be created after the commit, not
by `changeset publish` while it runs. Tagging first is what made every tag point
at the commit _before_ its own version bump ([SDK-298]).

Tags from `e2b@2.36.1`, `@e2b/cli@2.16.0` and `@e2b/python-sdk@2.35.0` and
earlier are still off by one and are not going to be retagged, because moving
published tags breaks anything that already pinned them. Build those versions
from the npm tarball or the PyPI sdist rather than from the git tag.

[SDK-298]: https://linear.app/e2b/issue/SDK-298
