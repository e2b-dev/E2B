import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  AUTHOR_EMAIL,
  AUTHOR_NAME,
  cleanupBaseDir,
  createBaseDir,
  createRepo,
} from './helpers.js'

sandboxTest('git commit creates commit', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')
    await sandbox.git.add(repoPath, { all: true })

    await sandbox.git.commit(repoPath, 'Initial commit', {
      authorName: AUTHOR_NAME,
      authorEmail: AUTHOR_EMAIL,
    })

    const message = (
      await sandbox.commands.run(`git -C "${repoPath}" log -1 --pretty=%B`)
    ).stdout.trim()
    expect(message).toBe('Initial commit')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
