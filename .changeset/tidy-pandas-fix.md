---
"@e2b/python-sdk": patch
---

Fix custom GitHub MCP server configs being silently ignored: map the documented snake_case keys (`run_cmd`/`install_cmd`) to the camelCase wire names (`runCmd`/`installCmd`) the mcp-gateway expects before the config is serialized.
