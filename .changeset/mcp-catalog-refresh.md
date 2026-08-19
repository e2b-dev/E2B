---
'e2b': minor
'@e2b/python-sdk': minor
---

Refresh the MCP server schema from Docker's MCP catalog, which the `mcp` sandbox option and `Template.addMcpServer` are typed from. 52 servers are new — among them `curl`, `docker`, `ffmpeg`, `n8n`, `neo4j`, `temporal`, `proxmox`, `testkube`, `zen`, and 30 AWS ones — and every server's title and description now matches what the catalog publishes today.

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  mcp: {
    docker: {},
    ffmpeg: {},
    n8n: { apiUrl: 'https://n8n.example.com/api/v1', apiKey: process.env.N8N_API_KEY! },
  },
})
```

```python
import os

from e2b import Sandbox

sandbox = Sandbox.create(
    mcp={
        "docker": {},
        "ffmpeg": {},
        "n8n": {"apiUrl": "https://n8n.example.com/api/v1", "apiKey": os.environ["N8N_API_KEY"]},
    },
)
```

Some servers changed in ways that stop existing configuration from type-checking. Six the catalog no longer publishes are gone: `cdataConnectcloud`, `flexprice`, `postgres`, `root`, `tembo`, and `triplewhale`. `awsDiagram` and `context7` took no options before and now require one (`outputDir` and `apiKey`), so `awsDiagram: {}` and `context7: {}` need a value. `onlyofficeDocspace` is down to `baseUrl` and `docspaceApiKey`, having lost `docspaceAuthToken`, `docspacePassword`, `docspaceUsername`, `dynamic`, `origin`, `toolsets`, and `userAgent`. `neo4jCypher` gained `schemaSampleSize`.

The removals land in two places. The `mcp` sandbox option is handed to the gateway as you write it, so a dropped server can be kept by casting past the type — whether it starts is up to the gateway. `Template.addMcpServer` in the JS SDK takes `McpServerName`, which is `keyof McpServer`, so a dropped name needs `addMcpServer('postgres' as McpServerName)`; it runs `mcp-gateway pull`, which either finds the server or doesn't. Python's `add_mcp_server` takes a plain `str` and is unaffected either way.
