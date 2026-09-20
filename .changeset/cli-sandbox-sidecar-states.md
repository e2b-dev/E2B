---
'@e2b/cli': minor
---

Add the `e2b sidecar-state` command group: `list` (`--format json|pretty`) shows the team's saved sidecar states, `get <name>` shows one with its versions, `delete <name> [--version N]` removes a name or one version, and `save <sandboxID> <entry> <name>` saves a running sidecar's data disk as a new version. `e2b sandbox info` gains a `SAVED STATE` column for the sandboxes whose sidecars were attached from one.
