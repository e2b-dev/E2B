---
'@e2b/cli': minor
---

Add `--profile` support to the CLI.

Named profiles can be defined in `~/.config/e2b/config` (extensionless TOML):

```toml
[profiles.default]
api_key = "e2b_..."
team_id = "..."

[profiles.staging]
api_key = "e2b_..."
domain = "staging.e2b.app"
team_id = "..."
```

All fields (`api_key`, `team_id`, `domain`) are optional. Use a profile with any command:

```
e2b sandbox list --profile staging
e2b auth configure --profile staging
```

The existing `~/.e2b/config.json` is still read as a fallback for the `default` profile. On next `e2b auth login` or `e2b auth configure`, it will be migrated to the new TOML format.
