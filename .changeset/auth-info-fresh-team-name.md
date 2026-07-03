---
"@e2b/cli": patch
---

Fetch fresh team name from the API when running `e2b auth info`, so the displayed team name is always up-to-date. If the team was renamed or the cached name is missing, the local config is updated automatically. Falls back to the cached config when the API is unavailable.
