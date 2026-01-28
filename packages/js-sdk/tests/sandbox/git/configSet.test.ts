import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'

sandboxTest('git configSet updates local config', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)

    await sandbox.git.configSet('pull.rebase', 'true', {
      scope: 'local',
      path: repoPath,
    })

    const value = (await sandbox.commands.run(
      `git -C "${repoPath}" config --local --get pull.rebase`
    )).stdout.trim()
    expect(value).toBe('true')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
