import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../../setup.js'

const enabled = process.env.E2B_DEBUG_GITHUB_CREATE_REPO !== undefined
const token =
  process.env.E2B_DEBUG_GITHUB_TOKEN ??
  process.env.GITHUB_PAT ??
  process.env.GITHUB_TOKEN ??
  process.env.GH_TOKEN
const org = process.env.E2B_DEBUG_GITHUB_ORG
const repoPrefix = process.env.E2B_DEBUG_GITHUB_REPO_PREFIX ?? 'e2b-debug-git-'
const apiBaseUrl =
  process.env.E2B_DEBUG_GITHUB_API_BASE_URL ?? 'https://api.github.com'

const shouldSkip = !isDebug || !enabled || !token
const debugGitTest = sandboxTest.skipIf(shouldSkip)

const repoPath = '/tmp/e2b-github-create-repo'

function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 80)
}

function buildRepoName(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return sanitizeRepoName(`${repoPrefix}${unique}`)
}

async function deleteGitHubRepo(owner: string, name: string): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token!}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Failed to delete GitHub repo ${owner}/${name}: ${response.status} ${body}`
    )
  }
}

debugGitTest(
  'createGitHubRepo creates a remote repo and wires origin (debug-only)',
  async ({ sandbox }) => {
    const repoName = buildRepoName()
    let ownerLogin: string | undefined

    await sandbox.commands.run(`rm -rf "${repoPath}"`)

    try {
      await sandbox.git.init(repoPath, { initialBranch: 'main' })

      const repo = await sandbox.git.createGitHubRepo({
        token: token!,
        name: repoName,
        org,
        private: true,
        autoInit: false,
        apiBaseUrl,
        addRemote: {
          path: repoPath,
          overwrite: true,
        },
      })

      ownerLogin = repo.ownerLogin

      const remoteUrl = await sandbox.commands.run(
        `git -C "${repoPath}" remote get-url origin`
      )
      expect(remoteUrl.stdout).toContain(repoName)
    } finally {
      await sandbox.commands.run(`rm -rf "${repoPath}"`)

      if (ownerLogin) {
        await deleteGitHubRepo(ownerLogin, repoName)
      }
    }
  }
)
