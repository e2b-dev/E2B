---
'@e2b/cli': major
---

**Breaking:** `~/.e2b/config.json` now uses `project` naming instead of `team`. The config format version is bumped to 2 and the `teamName`, `teamId`, and `teamApiKey` fields are renamed to `projectName`, `projectId`, and `projectApiKey`. Existing v1 configs are migrated automatically on first read; tools that read the config file directly must switch to the new field names. CLI output now refers to the selected workspace as a project (e.g. `e2b auth info` prints `Selected project`).
