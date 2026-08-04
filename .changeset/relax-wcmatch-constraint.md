---
'@e2b/python-sdk': patch
---

Relax the Python SDK's `wcmatch` requirement from `>=10.1,<11` to `>=10.1,<12` so `e2b` can be installed alongside packages that already require `wcmatch>=11` (for example `deepagents>=0.7.0`), which previously failed to resolve. The SDK only calls `glob.glob()` with `GLOBSTAR | DOTMATCH` for template context matching; wcmatch 11.0's single breaking change affects `translate()` callers using extended-glob capture groups, so it is a no-op here. The template glob test suite passes against 10.1, 10.2.1 and 11.0.
