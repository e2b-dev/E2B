import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepoWithCommit } from './helpers.js'

sandboxTest('git restore --staged unstages changes', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'changed\n')
    await sandbox.git.add(repoPath, { files: ['README.md'] })

    const status = await sandbox.git.status(repoPath)
    expect(status.hasStaged).toBe(true)

    await sandbox.git.restore(repoPath, {
      paths: ['README.md'],
      staged: true,
      worktree: false,
    })

    const statusAfter = await sandbox.git.status(repoPath)
    expect(statusAfter.hasStaged).toBe(false)
    expect(statusAfter.hasChanges).toBe(true)
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest('git restore discards working tree changes', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'changed\n')

    const status = await sandbox.git.status(repoPath)
    expect(status.isClean).toBe(false)

    await sandbox.git.restore(repoPath, { paths: ['README.md'] })

    const statusAfter = await sandbox.git.status(repoPath)
    expect(statusAfter.isClean).toBe(true)

    const contents = await sandbox.files.read(`${repoPath}/README.md`)
    expect(contents).toBe('hello\n')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
