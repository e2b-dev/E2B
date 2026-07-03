---
"e2b": minor
"@e2b/python-sdk": minor
---

Add a `name` filter to `Sandbox.listSnapshots()` / `Sandbox.list_snapshots()`.

The filter accepts a snapshot name or ID, optionally tag-qualified (e.g.
`"my-snapshot"`, `"my-team/my-snapshot"` or `"my-snapshot:v1"`). Unknown names
return an empty list rather than an error.

The `sandboxId` / `sandbox_id` and `name` filters are mutually exclusive —
passing both raises an error.

```ts
// JS/TS
const paginator = Sandbox.listSnapshots({ name: 'my-snapshot' })
const snapshots = await paginator.nextItems()
```

```python
# Python (sync)
paginator = Sandbox.list_snapshots(name="my-snapshot")
snapshots = paginator.next_items()

# Python (async)
paginator = AsyncSandbox.list_snapshots(name="my-snapshot")
snapshots = await paginator.next_items()
```
