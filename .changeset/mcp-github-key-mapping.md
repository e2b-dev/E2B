---
"e2b": patch
---

Fix GitHub-based MCP server configs: the Python SDK now maps the documented `install_cmd` / `run_cmd` keys to `installCmd` / `runCmd` on the way to the gateway, so the shape in `GitHubMcpServerConfig` and the Python docs actually works. Previously the gateway silently dropped the server with a "missing run command" warning.
