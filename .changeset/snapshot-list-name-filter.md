---
"e2b": minor
"@e2b/python-sdk": minor
---

Add a `name` filter to `Sandbox.listSnapshots()` / `Sandbox.list_snapshots()`
and move snapshot list filters into a `query` object, matching the shape of
`Sandbox.list()`.

The filter accepts a snapshot name or ID, optionally tag-qualified (e.g.
`"my-snapshot"`, `"my-team/my-snapshot"` or `"my-snapshot:v1"`). Unknown names
return an empty list rather than an error.

The `sandboxId` and `name` filters are mutually exclusive — provide at most one.

Note: this reshapes the recently added snapshot list filter — the `sandboxId`
filter now lives inside `query` instead of being a top-level option.

```ts
// JS/TS
const paginator = Sandbox.listSnapshots({ query: { name: 'my-snapshot' } })
const snapshots = await paginator.nextItems()

// still filter by source sandbox
Sandbox.listSnapshots({ query: { sandboxId: 'sandbox-id' } })
```

```python
# Python (sync)
from e2b import Sandbox, SnapshotQuery

paginator = Sandbox.list_snapshots(query=SnapshotQuery(name="my-snapshot"))
snapshots = paginator.next_items()

# Python (async)
from e2b import AsyncSandbox, SnapshotQuery

paginator = AsyncSandbox.list_snapshots(query=SnapshotQuery(name="my-snapshot"))
snapshots = await paginator.next_items()
```
