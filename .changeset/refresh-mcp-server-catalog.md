---
'e2b': minor
'@e2b/python-sdk': minor
---

Refresh the MCP server types from the current MCP gateway catalog: 49 servers are new (`n8n`, `neo4j`, `okta`, `temporal`, `proxmox`, `zscaler`, the AWS Labs family, ...), 61 titles and 10 descriptions were rewritten, and 4 servers changed their options (`awsDiagram`, `context7`, `neo4jCypher`, `onlyofficeDocspace`).

Six servers the catalog no longer publishes are gone from `McpServer`: `postgres`, `root`, `tembo`, `flexprice`, `triplewhale`, `cdataConnectcloud`. `awsDiagram` and `context7` now require an option (`outputDir` and `apiKey`), so `awsDiagram: {}` and `context7: {}` stop type-checking, and `onlyofficeDocspace` is down to `baseUrl` and `docspaceApiKey`. The removals also narrow `McpServerName`, so `Template().addMcpServer('postgres')` stops compiling. The config is still passed to the gateway as written, so a dropped server can be kept by casting past the type — whether it starts is up to the gateway.

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  mcp: {
    n8n: {
      apiKey: process.env.N8N_API_KEY!,
      apiUrl: 'https://n8n.example.com/api/v1',
    },
  },
})
```
