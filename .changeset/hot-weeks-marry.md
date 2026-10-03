---
'e2b': patch
'@e2b/python-sdk': patch
---

Fix Dockerignore patterns with a leading `**` and a literal suffix, such as `**.txt`, to match filenames at any depth when copying template files. Preserve regex matching when the suffix contains additional wildcard syntax. The suffix match is newline-safe: filenames containing newlines still match on the literal suffix, and a trailing newline does not satisfy it.
