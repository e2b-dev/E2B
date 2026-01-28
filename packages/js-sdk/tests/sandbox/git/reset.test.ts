import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepoWithCommit } from './helpers.js'

sandboxTest('git reset --hard discards changes', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'changed\n')

    const status = await sandbox.git.status(repoPath)
    expect(status.isClean).toBe(false)

    await sandbox.git.reset(repoPath, { mode: 'hard', target: 'HEAD' })

    const statusAfter = await sandbox.git.status(repoPath)
    expect(statusAfter.isClean).toBe(true)

    const contents = await sandbox.files.read(`${repoPath}/README.md`)
    expect(contents).toBe('hello\n')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
