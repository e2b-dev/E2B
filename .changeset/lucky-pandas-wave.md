---
'e2b': patch
---

Bump the `glob` dependency from `^11.1.0` to `^13.0.6`. glob 11 is deprecated on npm, so every install of a project depending on `e2b` printed a `npm warn deprecated glob@11.1.0` warning that downstream packages could not silence (`overrides` and shrinkwrap only apply to the top-level project). glob 12 and 13 only changed the CLI — the `--shell` option and the `glob` bin, which moved to a separate `glob-bin` package — so the programmatic API the SDK uses (`glob(pattern, { ignore, withFileTypes, dot, cwd })` plus `Path#isDirectory()/fullpath()/relative()`) is unchanged. glob 13 also drops the CLI's transitive dependencies, cutting a fresh `npm install e2b` from 37 to 26 packages.
