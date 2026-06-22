---
"e2b": minor
"@e2b/python-sdk": minor
---

Add a `keepMemory` (`keep_memory` in Python) option to the sandbox `lifecycle`
config, controlling the snapshot kind taken when a sandbox auto-pauses on
timeout.

When `keepMemory` is `false`, a timeout auto-pause drops the in-memory state and
persists only the filesystem (a filesystem-only snapshot); resuming such a
sandbox cold-boots (reboots) it from disk, losing running processes and open
connections. Defaults to `true` (full memory snapshot). It only applies when
`onTimeout`/`on_timeout` is `pause`, and cannot be combined with auto-resume (a
filesystem-only snapshot must be resumed explicitly).

```python
# Python
sbx = Sandbox(lifecycle={"on_timeout": "pause", "keep_memory": False})
```

```ts
// JS/TS
const sbx = await Sandbox.create({
  lifecycle: { onTimeout: 'pause', keepMemory: false },
})
```
