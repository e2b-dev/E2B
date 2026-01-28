import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepoWithCommit,
} from './helpers.js'

sandboxTest('git checkoutBranch switches branch', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.commands.run(`git -C "${repoPath}" branch feature`)

    await sandbox.git.checkoutBranch(repoPath, 'feature')

    const head = (
      await sandbox.commands.run(
        `git -C "${repoPath}" rev-parse --abbrev-ref HEAD`
      )
    ).stdout.trim()
    expect(head).toBe('feature')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
