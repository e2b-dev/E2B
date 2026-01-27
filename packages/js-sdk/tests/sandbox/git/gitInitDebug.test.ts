import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../../setup.js'

const gitInitEnabled = process.env.E2B_DEBUG_GIT_INIT !== undefined
const shouldSkip = !isDebug || !gitInitEnabled
const debugGitTest = sandboxTest.skipIf(shouldSkip)

const repoPath = '/tmp/e2b-git-init-repo'
const initialBranch = 'main'

debugGitTest(
  'git init creates a repo with the requested initial branch (debug-only)',
  async ({ sandbox }) => {
    await sandbox.commands.run(`rm -rf "${repoPath}"`)

    try {
      await sandbox.git.init(repoPath, { initialBranch })

      const repoCheck = await sandbox.commands.run(
        `if [ -d "${repoPath}/.git" ]; then echo found; else echo missing; fi`
      )
      expect(repoCheck.stdout.trim()).toBe('found')

      const branchCheck = await sandbox.commands.run(
        `git -C "${repoPath}" symbolic-ref --short HEAD`
      )
      expect(branchCheck.stdout.trim()).toBe(initialBranch)
    } finally {
      await sandbox.commands.run(`rm -rf "${repoPath}"`)
    }
  }
)
