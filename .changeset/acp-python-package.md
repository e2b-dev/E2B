---
"@e2b/acp-python": minor
---

Add `e2b-acp` for running [Agent Client Protocol](https://agentclientprotocol.com) agents such as goose, OpenCode or Claude Code (through its ACP adapter) inside an E2B sandbox. `AcpAgent.start(sandbox, command, client)` starts the agent over stdin/stdout and returns the ACP client connection; `client` can also be a function that creates the client from the connection. Client filesystem and terminal capabilities are turned off and agent requests for them are rejected, so the agent edits files and runs commands with its own tools in the sandbox.
