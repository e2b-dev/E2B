---
'@e2b/cli': minor
---

`e2b template list` pages through `GET /v2/templates` like `e2b sandbox list`: it returns up to 1000 templates by default, `-l, --limit <limit>` changes the cap (`0` for no limit), and the pretty output says when more templates exist. The `--select` prompts of `template delete`/`template publish` list every template.
