---
'e2b': minor
'@e2b/python-sdk': minor
---

Add Secrets Management to the SDK. The `Secret` class (and `AsyncSecret` in Python) now manages E2B secrets: `create` and `update` store secret values (write-only — no read surface returns them), `getInfo` / `get_info` and the paginated `list` read metadata, `exists` and `destroy` are idempotent existence and lifecycle helpers, and `fill` formats the `${e2b.secrets.name}` marker that the egress proxy resolves to the secret's current value in network rule request transforms.
