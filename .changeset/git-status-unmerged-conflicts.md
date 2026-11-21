---
'e2b': patch
---

Report the `AA` (both added) and `DD` (both deleted) unmerged entries of `git status --porcelain=1` as conflicts in `Sandbox.git.status()` and `AsyncSandbox.git.status()`. Only the unmerged pairs containing a `U` were recognized before, so a merge stopped on an add/add or a both-deleted conflict came back with `has_conflicts` false and `conflict_count` zero, and the entries were labeled `added` / `deleted`.
