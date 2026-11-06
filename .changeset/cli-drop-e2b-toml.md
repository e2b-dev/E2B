---
'@e2b/cli': minor
---

`e2b template migrate` no longer reads `e2b.toml`: pass `--name`, `--cmd`, `--ready-cmd`, `--cpu-count` and `--memory-mb` instead. Its `--config` and `--path` flags are deprecated (`--config` is ignored), and the hidden `--config` on `template delete`, `publish`, `unpublish` and `sandbox create` now warns that it is deprecated and ignored.
