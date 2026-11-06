---
'@e2b/cli': minor
---

`e2b template migrate` no longer reads `e2b.toml`: pass `--name`, `--cmd`, `--ready-cmd`, `--cpu-count` and `--memory-mb` instead. Its `--config` and `--path` flags are deprecated (`--config` is ignored). `template delete`, `publish` and `unpublish` no longer accept `--config`.
