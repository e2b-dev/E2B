---
'e2b': patch
'@e2b/python-sdk': patch
---

Fix `git.status()` reporting `detached: true` when an upstream branch name merely contains the substring "detached" (e.g. `origin/detached-work`), and fix incorrect branch/upstream parsing when the branch header contains more than one `...` separator
