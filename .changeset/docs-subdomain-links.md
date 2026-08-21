---
'e2b': patch
'@e2b/cli': patch
'@e2b/python-sdk': patch
---

Point the README documentation links at `docs.e2b.dev` instead of `e2b.dev/docs`. The docs site moved to its own subdomain and has no `/docs` path prefix there, so `e2b.dev/docs` serves a 308 to `docs.e2b.dev/` and `e2b.dev/docs/code-interpreting` maps to `docs.e2b.dev/code-interpreting`. The UTM parameters are unchanged and survived the redirect, so this removes a redirect hop rather than fixing broken attribution.
