---
"@e2b/cli": patch
---

`e2b template migrate` no longer silently writes the template ID into the template name slot of the generated build files when `e2b.toml` has no `template_name`. The CLI now resolves the template's alias via the API and uses it as the name. When the alias cannot be resolved (offline, not logged in, or the template has no alias), it falls back to the previous behavior and prints a warning explaining that building with the ID as the name fails with a 409 alias collision, and how to fix it (`--name` or editing the generated files).
