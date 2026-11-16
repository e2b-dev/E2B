---
'e2b': patch
'@e2b/python-sdk': patch
---

Include directory symlink contents in template COPY uploads and cache hashes when symlink resolution is enabled, while honoring ignore rules. Report cyclic or out-of-context resolved paths as build errors at the user copy callsite.
