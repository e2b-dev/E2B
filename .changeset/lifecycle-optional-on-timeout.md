---
'e2b': patch
'@e2b/python-sdk': patch
---

Make `lifecycle.onTimeout` / `lifecycle["on_timeout"]` optional, so the "no timeout action configured" state the SDKs already put on the wire can actually be expressed by a typed caller, and treat a nullish `keepMemory` / `keep_memory` as unconfigured rather than as an explicit choice.

```ts
import { Sandbox } from 'e2b'

// Opt out of auto-resume without expressing a preference about the timeout
// action — previously a type error, since onTimeout was required.
await Sandbox.create({ lifecycle: { autoResume: false } })

// A keepMemory that spreads in as undefined is no longer sent as `true`, and no
// longer trips the pause-only guard on a kill action.
const keepMemory: boolean | undefined = undefined
await Sandbox.create({ lifecycle: { onTimeout: { action: 'pause', keepMemory } } })
```

```python
from e2b import Sandbox

# Opt out of auto-resume without expressing a preference about the timeout
# action — previously a type error, since on_timeout was required.
Sandbox.create(lifecycle={"auto_resume": False})

# A keep_memory that is None is no longer sent as True, and no longer trips the
# pause-only guard on a kill action.
Sandbox.create(lifecycle={"on_timeout": {"action": "pause", "keep_memory": None}})
```

`autoResume: True` still requires an explicit `onTimeout` of `'pause'`; the error now names that knob instead of implying the SDK knows which action the API would have picked.
