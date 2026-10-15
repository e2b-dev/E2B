---
'@e2b/cli': patch
---

Add `e2b volume` and `e2b secret` subcommands exposing the volume and secret management the SDK already provides. `e2b volume` supports `create`, `list`, `info`, and `delete` (`rm`); `e2b secret` supports `create` (with `--value` and `--metadata`), `list`, `info`, `update` (rotate the value into a new version), and `delete` (`rm`). Both follow the existing `e2b sandbox` command style (`--format json|pretty`, kubectl-style tables, `ensureAPIKey`).
