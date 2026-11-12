---
'@e2b/cli': minor
---

Upgrade commander to v15. Commands now reject unexpected extra positional arguments (e.g. `e2b sandbox pause <id> <extra>`) with an error instead of silently ignoring them.
