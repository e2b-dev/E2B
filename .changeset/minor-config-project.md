---
'@e2b/cli': minor
---

Rename the `team` fields in `~/.e2b/config.json` to `project`: the config format version is bumped to 2 and `teamName`, `teamId`, and `teamApiKey` become `projectName`, `projectId`, and `projectApiKey`. Existing v1 configs are migrated automatically on first read, so no re-login is needed; tools that read the config file directly must switch to the new field names. CLI output now refers to the selected workspace as a project (e.g. `e2b auth info` prints `Selected project`).
