---
'@e2b/cli': minor
---

Deprecate the `--team` flag on `template list`, `template publish`, `template unpublish`, and `template delete`. The flag is still accepted but no longer has any effect and prints a deprecation warning; the `E2B_TEAM_ID` env var and the config file's team ID are no longer read either. These commands are always scoped to the currently active project — the one your API key belongs to (`E2B_API_KEY` or the project selected via `e2b auth configure`). `template publish`, `template unpublish`, and `template delete` now require an API key up front and show a login hint when it is missing, instead of failing with a raw 401 from the API.
