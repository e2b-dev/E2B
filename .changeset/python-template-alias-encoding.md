---
"@e2b/python-sdk": patch
---

Fix URL encoding of namespaced template aliases in the Python SDK.

Namespaced aliases contain a slash (e.g. `namespace/name`), but the SDK
interpolated them into the request path without encoding, so a call like
`Template.exists("namespace/name")` hit `/templates/aliases/namespace/name`
instead of `/templates/aliases/namespace%2Fname`. Alias lookups via
`Template.exists` / `alias_exists` now percent-encode the value.

```python
from e2b import Template

# Namespaced templates now resolve correctly
Template.exists("my-team/my-template")
```
