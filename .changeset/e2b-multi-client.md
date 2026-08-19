---
'e2b': minor
'@e2b/python-sdk': minor
---

Add an `E2B` client that binds a connection config once and exposes the resource classes off it, so a single process can talk to several API keys, domains or deployments. The classes it exposes are per-client subclasses of the real `Sandbox`/`Volume` classes, so they behave exactly like the top-level ones — per-call options still win over the client's options, which win over the environment variables. The top-level exports (including the JS default export) are unchanged and keep reading the environment.

```ts
import { E2B } from 'e2b'

const client = new E2B({ apiKey: 'e2b_***', domain: 'e2b.dev' })

const sandbox = await client.Sandbox.create()
const volume = await client.Volume.create('my-volume')

// The classes can be destructured and used like the top-level ones.
const { Sandbox } = client
const paginator = Sandbox.list()
```

```python
from e2b import E2B

client = E2B(api_key="e2b_***", domain="e2b.dev")

sandbox = client.Sandbox.create()
volume = client.Volume.create("my-volume")

# Async variants are exposed too.
async_sandbox = await client.AsyncSandbox.create()
```
