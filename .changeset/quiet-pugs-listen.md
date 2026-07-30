---
'@e2b/cli': patch
---

Depend on `e2b` through pnpm's `workspace:^` protocol instead of a registry range. `pnpm publish` rewrites it to the same concrete `^<version>` it had before, so the published package is unchanged — but the lockfile no longer has to be re-resolved against the tarballs a release uploads, which is what forced the release tags onto the commit before their own version bump.
