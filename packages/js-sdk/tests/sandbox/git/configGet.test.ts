import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'

sandboxTest('git configGet reads local config', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.commands.run(
      `git -C "${repoPath}" config --local pull.rebase true`
    )

    const value = await sandbox.git.configGet('pull.rebase', {
      scope: 'local',
      path: repoPath,
    })
    expect(value).toBe('true')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
