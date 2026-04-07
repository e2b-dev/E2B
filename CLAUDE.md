Use pnpm for node and poetry for python to install and update dependencies.
Run `pnpm run format`, `pnpm run lint` and `pnpm run typecheck` before commiting changes.
To re-generate the API client run `make codegen` in the repository root.
Run tests on affected codepaths using `pnpm run test`.
Default credentials are stored in .env.local in the repository root or inside ~/.e2b/config.json.

## AgentHub
- Central hub: `~/AgentHub/`
- Skills: `.agents/skills/` (symlinked to AgentHub shared skills)
- MCP: 12 servers synced across all agents
- Agents: 14 shared agents available
- Hooks: Safety, notification, and logging hooks
