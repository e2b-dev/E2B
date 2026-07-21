---
'@e2b/cli': minor
---

Rename the `team` fields in `~/.e2b/config.json` to `project`: the config format version is bumped to 2 and `teamName`, `teamId`, and `teamApiKey` become `projectName`, `projectId`, and `projectApiKey`. Existing v1 configs keep working — they are converted to the new format in memory on read, and the file on disk is only rewritten in the new format when the config is persisted anyway (login, `e2b auth configure`, token refresh), so older CLI versions can still read it in the meantime. Unrecognized configs are no longer deleted; the CLI treats them as signed out and `e2b auth login` overwrites them. Tools that read the config file directly must handle the new field names. CLI output and flags are unchanged and still say "team".
