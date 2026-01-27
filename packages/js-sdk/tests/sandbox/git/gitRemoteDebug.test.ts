import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../../setup.js'

const gitRemoteEnabled = process.env.E2B_DEBUG_GIT_REMOTE !== undefined
const shouldSkip = !isDebug || !gitRemoteEnabled
const debugGitTest = sandboxTest.skipIf(shouldSkip)

const repoPath = '/tmp/e2b-git-remote-repo'
const remoteName = 'origin'
const firstUrl = 'https://example.com/first.git'
const secondUrl = 'https://example.com/second.git'

debugGitTest(
  'remoteAdd sets and overwrites a remote URL (debug-only)',
  async ({ sandbox }) => {
    await sandbox.commands.run(`rm -rf "${repoPath}"`)

    try {
      await sandbox.git.init(repoPath, { initialBranch: 'main' })

      await sandbox.git.remoteAdd(repoPath, remoteName, firstUrl)
      const firstCheck = await sandbox.commands.run(
        `git -C "${repoPath}" remote get-url ${remoteName}`
      )
      expect(firstCheck.stdout.trim()).toBe(firstUrl)

      await sandbox.git.remoteAdd(repoPath, remoteName, secondUrl, {
        overwrite: true,
      })
      const secondCheck = await sandbox.commands.run(
        `git -C "${repoPath}" remote get-url ${remoteName}`
      )
      expect(secondCheck.stdout.trim()).toBe(secondUrl)
    } finally {
      await sandbox.commands.run(`rm -rf "${repoPath}"`)
    }
  }
)
