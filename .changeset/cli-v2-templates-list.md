---
'@e2b/cli': minor
---

- `e2b template list` pages through `GET /v2/templates` like `e2b sandbox list`: up to 1000 templates by default in pretty output (JSON output stays unlimited), `-l, --limit <limit>` to change it (`0` for no limit), and a hint in pretty output when more exist.
- Breaking: the interactive `-s, --select` mode of `e2b template delete`, `publish` and `unpublish` is removed; the template is now a required argument, and their unused `-t, --project` and `--team` options are removed.
