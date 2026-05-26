---
'e2b': patch
---

Add `signal: AbortSignal` option to `Template.build`, `Template.buildInBackground`, `Template.getBuildStatus`, `Template.exists`, `Template.aliasExists`, `Template.assignTags`, `Template.removeTags`, and `Template.getTags`. When the signal is aborted, the underlying request (and, for `Template.build`, the status polling loop) is cancelled and the returned promise rejects with an `AbortError`.
