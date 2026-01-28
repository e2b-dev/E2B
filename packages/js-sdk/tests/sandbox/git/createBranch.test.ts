import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepoWithCommit } from './helpers.js'

sandboxTest('git createBranch creates and checks out branch', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.git.createBranch(repoPath, 'feature')

    const branches = await sandbox.git.branches(repoPath)
    expect(branches.branches).toContain('feature')
    expect(branches.currentBranch).toBe('feature')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
