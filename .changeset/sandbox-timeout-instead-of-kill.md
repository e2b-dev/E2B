---
'@e2b/cli': patch
---

Replace sandbox.kill() with sandbox.setTimeout(1s) in the CLI create command to prevent accidental historic sandbox snapshot deletions
