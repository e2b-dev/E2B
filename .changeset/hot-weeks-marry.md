---
'e2b': patch
'@e2b/python-sdk': patch
---

Fix Dockerignore patterns with a leading `**` and a literal suffix, such as `**.txt`, to match filenames at any depth when copying template files. Preserve regex matching when the suffix contains additional wildcard syntax.
