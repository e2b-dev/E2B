---
'@e2b/cli': patch
---

Remove dead `saveConfig` code path — the CLI no longer writes `e2b.toml` anywhere; parsing stays for legacy projects (`template migrate`, `template publish`, `template delete`, `sandbox create`)
