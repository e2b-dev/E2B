---
'@e2b/python-sdk': patch
'e2b': patch
---

Fix Git status parsing when a tracked upstream branch name contains the word `detached`. Attached branches now keep their branch and upstream fields instead of being reported as detached HEADs.
