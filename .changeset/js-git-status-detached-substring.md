---
"e2b": patch
---

Fix `parseGitStatus` so a branch or upstream whose name merely contains the substring `detached` (for example `main` tracking `origin/detached-work`) is no longer misreported as a detached HEAD. Detached-HEAD detection now keys off the `HEAD (detached at <sha>)` / `HEAD (no branch)` porcelain forms only, so `currentBranch` and `upstream` are preserved. This mirrors the Python SDK fix for the same defect (#1373).
