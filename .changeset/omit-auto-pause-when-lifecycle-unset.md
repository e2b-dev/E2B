---
'e2b': patch
'@e2b/python-sdk': patch
---

Omit `autoPause` from the create-sandbox request when no timeout lifecycle is configured, and omit `autoPauseMemory` unless `keepMemory` / `keep_memory` was chosen. Sending the SDK's local defaults for those fields was indistinguishable from an explicit choice, so the API could not tell "no preference" from a client choice and own its defaults. Explicit values are sent exactly as before:

```ts
import { Sandbox } from 'e2b'

// No timeout lifecycle: autoPause is omitted, the API applies its default.
await Sandbox.create()

// Explicit action: autoPause: false / autoPause: true, as before.
await Sandbox.create({ lifecycle: { onTimeout: 'kill' } })
await Sandbox.create({ lifecycle: { onTimeout: 'pause' } })

// Snapshot kind is only sent when keepMemory is set.
await Sandbox.create({
  lifecycle: { onTimeout: { action: 'pause', keepMemory: false } },
})
```

```python
from e2b import Sandbox

# No timeout lifecycle: auto_pause is omitted, the API applies its default.
Sandbox.create()

# Explicit action: autoPause: false / autoPause: true, as before.
Sandbox.create(lifecycle={"on_timeout": "kill"})
Sandbox.create(lifecycle={"on_timeout": "pause"})

# Snapshot kind is only sent when keep_memory is set.
Sandbox.create(
    lifecycle={"on_timeout": {"action": "pause", "keep_memory": False}}
)
```
