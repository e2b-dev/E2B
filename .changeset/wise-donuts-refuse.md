---
'@e2b/cli': patch
---

Remove dead `e2b.toml` code paths — the CLI no longer writes the file, so `saveConfig` is gone, and the unused `team_id` field is no longer part of the config schema or team ID resolution. Parsing stays for legacy projects (`template migrate`, `template publish`, `template delete`, `sandbox create`)
