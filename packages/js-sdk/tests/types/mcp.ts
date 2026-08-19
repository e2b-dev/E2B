/**
 * `src/sandbox/mcp.d.ts` is generated from Docker's MCP catalog, and nothing
 * type-checks it: `tsc` doesn't report errors inside a declaration file under
 * `skipLibCheck`, and the generated-files CI check only proves the file
 * reproduces. These fixtures put the generated types back under the compiler,
 * so a catalog refresh that drops or renames a server, or changes what one
 * takes, fails the build instead of silently reshaping the option.
 *
 * Not a test file — `tests/types` is in `tsconfig.json`'s `include`, and
 * vitest only collects `*.test.ts`.
 */

import type { McpServer } from '../../src/sandbox/sandboxApi'
import type { McpServerName } from '../../src/template/types'

// One server of each shape the catalog produces: no options at all, a single
// credential, an array parameter, and a nested parameter object flattened into
// one name.
export const servers: McpServer = {
  docker: {},
  exa: { apiKey: 'exa-key' },
  filesystem: { paths: ['/home/user'] },
  githubOfficial: { githubPersonalAccessToken: 'gh-token' },
  atlassian: {
    confluenceUrl: 'https://acme.atlassian.net/wiki',
    jiraUrl: 'https://acme.atlassian.net',
    jiraApiToken: 'jira-token',
  },
}

// A GitHub-hosted server is configured by repository rather than by catalog
// name, and keeps working whatever the catalog publishes.
export const custom: McpServer = {
  'github/modelcontextprotocol/servers': {
    installCmd: 'npm install',
    runCmd: 'npx -y @modelcontextprotocol/server-filesystem /home/user',
  },
}

// `Template.addMcpServer` accepts catalog names, so the same removals break it.
// `exa` is the server the template tests build with.
export const name: McpServerName = 'exa'
