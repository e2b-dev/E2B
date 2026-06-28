---
"e2b": patch
"@e2b/python-sdk": patch
---

Fix git status parsing so a branch or upstream whose name merely contains the substring `detached` (for example `main` tracking `origin/detached-work`) is no longer misreported as a detached HEAD. Detached-HEAD detection now keys off the `HEAD (detached at <sha>)` / `HEAD (no branch)` porcelain forms only, so branch and upstream information is preserved in both SDKs.
