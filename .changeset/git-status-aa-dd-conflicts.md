---
'e2b': patch
'@e2b/python-sdk': patch
---

Classify `AA` (both added) and `DD` (both deleted) `git status --porcelain=1` entries as `conflict` in `parseGitStatus` / `parse_git_status`.
