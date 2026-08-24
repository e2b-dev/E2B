---
'@e2b/cli': minor
---

Stop reading `e2b.toml` in `sandbox create`, `template delete` and `template publish`/`unpublish`, and remove their `--config` and `--path` options. Templates must now be passed as an argument or picked interactively with `-s`. `template migrate` is unchanged and remains the only command that reads `e2b.toml`.
