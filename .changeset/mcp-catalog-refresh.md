---
'e2b': minor
'@e2b/python-sdk': minor
---

Refresh the MCP server schema from Docker's MCP catalog, which the `mcp` sandbox option is typed from. 52 servers are new — among them `curl`, `docker`, `ffmpeg`, `n8n`, `neo4j`, `temporal`, `playwright`, and 26 AWS servers — and every server's title and description now matches what the catalog publishes today.

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.betaCreate({
  mcp: {
    docker: {},
    n8n: { apiUrl: 'https://n8n.example.com/api/v1', apiKey: process.env.N8N_API_KEY! },
  },
})
```

```python
from e2b import Sandbox

sandbox = Sandbox.beta_create(
    mcp={
        "docker": {},
        "n8n": {"apiUrl": "https://n8n.example.com/api/v1", "apiKey": os.environ["N8N_API_KEY"]},
    },
)
```

Six servers the catalog no longer publishes are gone from the type: `cdataConnectcloud`, `flexprice`, `postgres`, `root`, `tembo`, and `triplewhale`. Four more changed what they accept: `awsDiagram` takes `outputDir`, `context7` takes `apiKey`, `neo4jCypher` takes `schemaSampleSize`, and `onlyofficeDocspace` is down to `docspaceApiKey`. The configuration is still handed to the gateway as you write it, so a server the catalog dropped can be kept by casting past the type — whether it starts is up to the gateway.
