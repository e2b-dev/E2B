---
"@e2b/cli": patch
---

Remove the unused `dockerfile-ast` dependency from the CLI. The CLI never imported it directly — all Dockerfile parsing goes through the `e2b` SDK, which keeps its own `dockerfile-ast` dependency. No behavior change.
