---
'e2b': patch
'@e2b/python-sdk': patch
---

Omit `autoPause` from the create-sandbox request when no timeout lifecycle is configured. Sending `autoPause: false` for an unconfigured sandbox was indistinguishable from an explicit `kill`, so the API could not tell "no preference" from a client choice and own its default. An explicit action is still always sent, so behavior is unchanged for callers that configure one:

```ts
import { Sandbox } from 'e2b'

// No timeout lifecycle: autoPause is omitted, the API applies its default.
await Sandbox.create()

// Explicit action: autoPause: false / autoPause: true, as before.
await Sandbox.create({ lifecycle: { onTimeout: 'kill' } })
await Sandbox.create({ lifecycle: { onTimeout: 'pause' } })
```

```python
from e2b import Sandbox

# No timeout lifecycle: auto_pause is omitted, the API applies its default.
Sandbox.create()

# Explicit action: autoPause: false / autoPause: true, as before.
Sandbox.create(lifecycle={"on_timeout": "kill"})
Sandbox.create(lifecycle={"on_timeout": "pause"})
```
