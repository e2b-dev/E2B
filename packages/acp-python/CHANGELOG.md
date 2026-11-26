# @e2b/acp-python

## 0.1.0

### Minor Changes

- 411610e: Add `e2b-acp` for running [Agent Client Protocol](https://agentclientprotocol.com) agents such as goose, OpenCode or Claude Code (through its ACP adapter) inside an E2B sandbox. `AsyncACPAgent(sandbox, command, client)` followed by `await agent.start()` starts the agent over stdin/stdout and connects your ACP client; `client` can also be a function that takes the connection and returns the client. Client filesystem and terminal capabilities are turned off and agent requests for them are rejected, so the agent edits files and runs commands with its own tools in the sandbox.

### Patch Changes

- Updated dependencies [6a729b0]
- Updated dependencies [08c4eeb]
  - @e2b/python-sdk@2.65.0
