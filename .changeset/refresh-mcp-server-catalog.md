---
'e2b': patch
'@e2b/python-sdk': patch
---

Refresh the MCP server types from the current MCP gateway catalog. 49 servers are new (`n8n`, `neo4j`, `okta`, `temporal`, `proxmox`, `zscaler`, the AWS Labs family, ...), 6 servers that the catalog no longer ships were dropped (`postgres`, `root`, `tembo`, `flexprice`, `triplewhale`, `cdataConnectcloud`), and the config options of 71 existing servers changed.

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.betaCreate({
  mcp: {
    n8n: {
      apiKey: process.env.N8N_API_KEY!,
      apiUrl: 'https://n8n.example.com/api/v1',
    },
  },
})
```
