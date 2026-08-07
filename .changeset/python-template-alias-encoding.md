---
"@e2b/python-sdk": patch
---

Fix URL encoding of namespaced template IDs and aliases in the Python SDK.

Namespaced identifiers contain a slash (e.g. `namespace/name`), but the SDK
interpolated them into the request path without encoding, so a call like
`Template.exists("namespace/name")` hit `/templates/aliases/namespace/name`
instead of `/templates/aliases/namespace%2Fname`. Every template method that
takes a template ID or alias in the path — `exists` / `alias_exists`,
`get_tags`, and the build/upload/status calls — now percent-encodes the value,
matching the JavaScript SDK (which already encodes path parameters via
`encodeURIComponent`).

```python
from e2b import Template

# Namespaced templates now resolve correctly
Template.exists("my-team/my-template")
Template.get_tags("my-team/my-template")
```
