---
"@e2b/cli": minor
---

Fully deprecate `e2b template migrate`: the command now only prints a deprecation notice pointing to https://e2b.dev/docs/template/migration-v2 and exits 1, without reading or renaming `e2b.toml` / `e2b.Dockerfile`. The CLI no longer parses `e2b.toml` anywhere, and the `@iarna/toml` and `yup` dependencies are removed. Use `e2b template init` or the Template SDK's `fromDockerfile()` instead.
