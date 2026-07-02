---
"e2b": patch
"@e2b/python-sdk": patch
---

fix(git): prevent crash on malformed branch lines and false detached HEAD detection

- Use `split("...", 1)` / `indexOf("...")` to avoid `ValueError` / incorrect destructuring when the branch line contains multiple `...` sequences (#1371)
- Remove overly broad `"detached" in raw_branch` / `rawBranch.includes('detached')` check that misidentified branches with "detached" in their name as detached HEAD (#1373)
