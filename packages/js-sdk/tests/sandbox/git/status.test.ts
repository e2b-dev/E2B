import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'

sandboxTest('git status reports untracked file', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')

    const status = await sandbox.git.status(repoPath)
    const entry = status.fileStatus.find((file: any) => file.name === 'README.md')
    expect(entry?.status).toBe('untracked')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
