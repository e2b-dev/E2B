import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepoWithCommit,
} from './helpers.js'

sandboxTest('git branches lists current and feature', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.commands.run(`git -C "${repoPath}" branch feature`)

    const branches = await sandbox.git.branches(repoPath)
    expect(branches.currentBranch).toBe('main')
    expect(branches.branches).toContain('main')
    expect(branches.branches).toContain('feature')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
