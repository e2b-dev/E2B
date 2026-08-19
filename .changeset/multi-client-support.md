---
'e2b': minor
'@e2b/python-sdk': minor
---

Add multi-client support via a new `E2B` client class in both SDKs. Existing top-level imports (`Sandbox`, `Volume`, `Secret`, `Template`) keep working and keep using environment-derived configuration. A client binds its own connection options (API key, domain, URLs, headers, proxy, timeouts) to the resources it exposes, and per-call options still override the client's defaults:

```ts
import E2B from 'e2b'

const { Sandbox, Volume, Secret, Template } = new E2B({ apiKey: 'e2b_...' })
const sbx = await Sandbox.create()
```

```py
from e2b import E2B

client = E2B(api_key="e2b_...")
sbx = client.Sandbox.create()
```

Note: the JS package default export is now the `E2B` client class; use the named import `import { Sandbox } from 'e2b'` instead of `import Sandbox from 'e2b'`.
