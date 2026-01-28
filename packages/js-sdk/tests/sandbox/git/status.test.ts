import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'

sandboxTest('git status reports untracked file', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')

    const status = await sandbox.git.status(repoPath)
    const entry = status.fileStatus.find(
      (file: any) => file.name === 'README.md'
    )
    expect(entry?.status).toBe('untracked')
    expect(status.isClean).toBe(false)
    expect(status.hasChanges).toBe(true)
    expect(status.hasUntracked).toBe(true)
    expect(status.hasStaged).toBe(false)
    expect(status.hasConflicts).toBe(false)
    expect(status.totalCount).toBe(1)
    expect(status.stagedCount).toBe(0)
    expect(status.unstagedCount).toBe(1)
    expect(status.untrackedCount).toBe(1)
    expect(status.conflictCount).toBe(0)
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
