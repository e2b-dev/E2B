---
'e2b': minor
'@e2b/python-sdk': minor
---

Add an `E2B` client that binds a connection config once and exposes the resource surfaces off it, so a single process can talk to several API keys, domains or deployments. The classes it exposes are per-client subclasses of the real `Sandbox`/`Volume`/`Template`/`Secret` classes, so they behave exactly like the top-level ones — per-call options still win over the client's options, which win over the environment variables. The named top-level exports are unchanged and keep reading the environment.

Nothing existing changes: `Template` is now the `TemplateBase` class made callable as a factory, so `Template(...)`, the statics and `instanceof` keep working, and the default export is still `Sandbox`.

```ts
import { E2B } from 'e2b'

const { Sandbox, Volume, Template, Secret } = new E2B({
  apiKey: 'e2b_***',
  domain: 'e2b.dev',
})

const sandbox = await Sandbox.create()
const volume = await Volume.create('my-volume')
const exists = await Template.exists('my-template')
await Template.build(Template().fromPythonImage('3'), 'my-env')
await Secret.create('openai-api-key', 'sk-***')
```

```python
from e2b import E2B

client = E2B(api_key="e2b_***", domain="e2b.dev")
Sandbox, Volume, Template = client.Sandbox, client.Volume, client.Template
Secret = client.Secret

sandbox = Sandbox.create()
volume = Volume.create("my-volume")
exists = Template.exists("my-template")
secret = Secret.create("openai-api-key", "sk-***")

# Async variants are exposed too.
AsyncSandbox = client.AsyncSandbox
async_sandbox = await AsyncSandbox.create()
```
