---
"e2b": minor
"@e2b/python-sdk": minor
---

Add an object form to the sandbox `lifecycle.onTimeout` (`on_timeout` in Python)
that controls the snapshot kind taken when a sandbox auto-pauses on timeout, via
`keepMemory` (`keep_memory`).

`onTimeout` now accepts either the existing bare action (`'pause'` / `'kill'`) or
the object form. The object form is a discriminated union on `action`:
`keepMemory` is only accepted alongside `action: 'pause'` — pairing it with
`action: 'kill'` is a compile-time type error (and is rejected at runtime for
untyped callers). When `keepMemory` is `false`, a timeout auto-pause drops the
in-memory state and persists only the filesystem (a filesystem-only snapshot);
resuming such a sandbox cold-boots (reboots) it from disk, losing running
processes and open connections. Defaults to `true` (full memory snapshot). It
cannot be combined with auto-resume: auto-resume wakes a paused sandbox on
inbound traffic by restoring its memory snapshot in place, and a filesystem-only
snapshot has no memory to restore (resuming cold-boots it), so it must be resumed
explicitly. The bare string form is unchanged.

```python
# Python
sbx = Sandbox.create(
    lifecycle={"on_timeout": {"action": "pause", "keep_memory": False}}
)
```

```ts
// JS/TS
const sbx = await Sandbox.create({
  lifecycle: { onTimeout: { action: 'pause', keepMemory: false } },
})
```
