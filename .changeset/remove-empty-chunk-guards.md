---
'e2b': patch
'@e2b/python-sdk': patch
---

Remove dead empty-chunk guards from command output handling; envd never sends empty output chunks, so behavior is unchanged.
