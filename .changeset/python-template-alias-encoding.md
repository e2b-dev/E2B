---
"@e2b/python-sdk": patch
---

Fix URL encoding of namespaced template IDs and aliases in the Python SDK.

Namespaced identifiers contain a slash (e.g. `namespace/name`), but the SDK
interpolated them into the request path without encoding, so a call like
`Template.exists("namespace/name")` hit `/templates/aliases/namespace/name`
instead of `/templates/aliases/namespace%2Fname`. Every method that takes a
template ID, alias, or snapshot ID in the path — `Template.exists` /
`alias_exists`, `get_tags`, the build/upload/status calls, and
`Sandbox.delete_snapshot` (whose snapshot IDs are `namespace/name:tag`) — now
percent-encodes the value, matching the JavaScript SDK (which already encodes
path parameters via `encodeURIComponent`).

```python
from e2b import Template, Sandbox

# Namespaced templates now resolve correctly
Template.exists("my-team/my-template")
Template.get_tags("my-team/my-template")

# Namespaced snapshots can now be deleted
Sandbox.delete_snapshot("my-team/my-snapshot:default")
```
