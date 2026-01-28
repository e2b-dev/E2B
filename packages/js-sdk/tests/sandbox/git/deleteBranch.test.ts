import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepoWithCommit } from './helpers.js'

sandboxTest('git deleteBranch removes branch', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.commands.run(`git -C "${repoPath}" branch feature`)

    await sandbox.git.deleteBranch(repoPath, 'feature', { force: true })

    const branch = (await sandbox.commands.run(
      `git -C "${repoPath}" branch --list feature`
    )).stdout.trim()
    expect(branch).toBe('')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
