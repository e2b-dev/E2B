---
'@e2b/cli': patch
---

`e2b sandbox create --detach` now prints only the sandbox ID to stdout; the dashboard inspect link and other informational output go to stderr so the ID is easily parseable (e.g. `SBX=$(e2b sandbox create -d)`).
