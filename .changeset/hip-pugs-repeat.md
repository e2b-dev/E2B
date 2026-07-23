---
'@e2b/cli': minor
---

Rename the `--team` flag to `--project` on `template list`, `template publish`, `template unpublish`, and `template delete`. The `--team` flag keeps working but is hidden from help and prints a deprecation warning. The project ID can also be set via the new `E2B_PROJECT_ID` environment variable; `E2B_TEAM_ID` is still supported and is used when `E2B_PROJECT_ID` is not set.
