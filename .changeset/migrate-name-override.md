---
"@e2b/cli": patch
---

Add override options to `e2b template migrate`: `--name`/`-n` to override the generated template name, `--cmd`/`-c` for the start command, `--ready-cmd` for the ready command, and `--cpu-count` / `--memory-mb` for sandbox resources. Each falls back to the value from the config file (`e2b.toml`) when not provided.
