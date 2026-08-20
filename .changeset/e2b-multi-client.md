---
'e2b': major
'@e2b/python-sdk': minor
---

Add an `E2B` client that binds a connection config once and exposes the resource surfaces off it, so a single process can talk to several API keys, domains or deployments. The classes it exposes are per-client subclasses of the real `Sandbox`/`Volume`/`Template` classes, so they behave exactly like the top-level ones — per-call options still win over the client's options, which win over the environment variables. The named top-level exports are unchanged and keep reading the environment.

**Breaking (JS):** the default export of `e2b` is now the `E2B` client instead of `Sandbox`. Use the named import (`import { Sandbox } from 'e2b'`) instead of `import Sandbox from 'e2b'`.

**Breaking (JS):** `Template` is now a class instead of a factory function, mirroring the Python SDK, so the builder is constructed with `new Template(...)` instead of `Template(...)`. The statics (`Template.build`, `Template.exists`, …) are unchanged, and `TemplateBase` is kept as a deprecated alias of `Template`.

```ts
import E2B from 'e2b'

const client = new E2B({ apiKey: 'e2b_***', domain: 'e2b.dev' })

const sandbox = await client.Sandbox.create()
const volume = await client.Volume.create('my-volume')
const exists = await client.Template.exists('my-template')
await client.Template.build(new client.Template().fromPythonImage('3'), 'my-env')

// The classes can be destructured and used like the top-level ones.
const { Sandbox } = client
const paginator = Sandbox.list()
```

```python
from e2b import E2B

client = E2B(api_key="e2b_***", domain="e2b.dev")

sandbox = client.Sandbox.create()
volume = client.Volume.create("my-volume")
exists = client.Template.exists("my-template")

# Async variants are exposed too.
async_sandbox = await client.AsyncSandbox.create()
```
