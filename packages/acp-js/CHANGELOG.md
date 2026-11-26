# @e2b/acp

## 0.1.0

### Minor Changes

- 73b4e61: Add `@e2b/acp` for running [Agent Client Protocol](https://agentclientprotocol.com) agents such as goose, OpenCode or Claude Code (through its ACP adapter) inside an E2B sandbox. `new ACPAgent(sandbox, command, client)` followed by `await agent.start()` starts the agent over stdin/stdout and connects your ACP `client()` app to it. Client filesystem and terminal capabilities are turned off and agent requests for them are rejected, so the agent edits files and runs commands with its own tools in the sandbox.

### Patch Changes

- Updated dependencies [6a729b0]
- Updated dependencies [ba66e82]
- Updated dependencies [aeb09d0]
- Updated dependencies [08c4eeb]
  - e2b@2.65.0
