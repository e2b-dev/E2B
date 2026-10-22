---
"@e2b/python-sdk": patch
---

Preserve an omitted `network.allow_public_traffic` when other network options are set, so the server applies its default. Explicit `True` and `False` values are unchanged.
