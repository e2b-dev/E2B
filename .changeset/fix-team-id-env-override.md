---
"@e2b/cli": patch
---

Fix CLI team ID resolution when E2B_API_KEY is set via environment variable. Add E2B_TEAM_ID env var support. Previously, the CLI always used the team ID from ~/.e2b/config.json, causing "Team ID param mismatch" errors when the API key belonged to a different team.
