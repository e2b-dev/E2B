---
'e2b': patch
'@e2b/python-sdk': patch
---

Omit `autoResume` from the `POST /sandboxes` request when `lifecycle.autoResume` / `lifecycle["auto_resume"]` is not configured, instead of sending the SDK's local default as `{ "autoResume": { "enabled": false } }`. The API can now tell an unset preference from an explicit opt-out and own the default itself. Explicit values are unchanged on the wire.

```ts
import { Sandbox } from 'e2b'

// autoResume is left out of the request entirely — the API's default applies
await Sandbox.create({ lifecycle: { onTimeout: 'pause' } })

// an explicit choice is still sent as before
await Sandbox.create({ lifecycle: { onTimeout: 'pause', autoResume: true } })
```

```python
from e2b import Sandbox

# auto_resume is left out of the request entirely — the API's default applies
Sandbox.create(lifecycle={"on_timeout": "pause"})

# an explicit choice is still sent as before
Sandbox.create(lifecycle={"on_timeout": "pause", "auto_resume": True})
```
