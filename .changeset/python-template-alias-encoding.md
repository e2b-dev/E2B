---
"@e2b/python-sdk": patch
---

Fix URL encoding of namespaced template names and aliases in the Python SDK.

The endpoints that take a template ID also accept a template name, and names may
be namespaced (e.g. `namespace/name`). The SDK interpolated them into the request
path without encoding, so a call like `Template.exists("namespace/name")` hit
`/templates/aliases/namespace/name` instead of
`/templates/aliases/namespace%2Fname` — the slash split the route rather than
staying inside one path segment. Every method that takes a template ID or name,
an alias, or a snapshot ID in the path — `Template.exists` / `alias_exists`,
`get_tags`, the build/upload/status calls, and `Sandbox.delete_snapshot` (whose
snapshot IDs are `namespace/name:tag`) — now percent-encodes the value, matching
the JavaScript SDK (which already encodes path parameters via
`encodeURIComponent`).

```python
from e2b import Template, Sandbox

# Namespaced templates now resolve correctly
Template.exists("my-team/my-template")
Template.get_tags("my-team/my-template")

# Namespaced snapshots can now be deleted
Sandbox.delete_snapshot("my-team/my-snapshot:default")
```
