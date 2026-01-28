import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'

sandboxTest('git getConfig reads local config', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.commands.run(
      `git -C "${repoPath}" config --local pull.rebase true`
    )

    const value = await sandbox.git.getConfig('pull.rebase', {
      scope: 'local',
      path: repoPath,
    })
    const commandValue = (
      await sandbox.commands.run(
        `git -C "${repoPath}" config --local --get pull.rebase`
      )
    ).stdout.trim()
    expect(value).toBe('true')
    expect(commandValue).toBe('true')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest('git setConfig updates local config', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)

    await sandbox.git.setConfig('pull.rebase', 'true', {
      scope: 'local',
      path: repoPath,
    })

    const value = (
      await sandbox.commands.run(
        `git -C "${repoPath}" config --local --get pull.rebase`
      )
    ).stdout.trim()
    const configuredValue = await sandbox.git.getConfig('pull.rebase', {
      scope: 'local',
      path: repoPath,
    })
    expect(value).toBe('true')
    expect(configuredValue).toBe('true')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
