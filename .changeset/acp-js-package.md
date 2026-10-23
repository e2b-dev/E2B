---
"@e2b/acp": minor
"e2b": patch
---

Add `@e2b/acp` for running [Agent Client Protocol](https://agentclientprotocol.com) agents such as goose, OpenCode or Claude Code (through its ACP adapter) inside an E2B sandbox. `connectAcpAgent(sandbox, command, client)` starts the agent over stdin/stdout and returns the ACP client connection. Client filesystem and terminal capabilities are turned off and agent requests for them are rejected, so the agent edits files and runs commands with its own tools in the sandbox. The JS SDK gets an internal way to stream a background command's output without keeping it in memory, used by this package.
