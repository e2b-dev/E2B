---
'@e2b/cli': patch
---

`e2b template list` and the `--select` prompts of `template delete`/`template publish` now page through `GET /v2/templates`, so they keep working for projects with more than 5000 templates.
