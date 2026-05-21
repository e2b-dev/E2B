---
'e2b': minor
---

feat(js-sdk): support `AbortSignal` for Template operations

`Template.build`, `Template.buildInBackground`, `Template.getBuildStatus`,
`Template.exists` / `Template.aliasExists`, `Template.assignTags`,
`Template.removeTags`, and `Template.getTags` now accept a `signal` option.
Aborting the signal cancels the in-flight request (and, for `Template.build`,
the status polling loop), rejecting the returned promise with an `AbortError`.
