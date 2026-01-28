import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepo,
  startGitDaemon,
} from './helpers.js'

sandboxTest('git remoteGet returns remote url', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)

    const missingUrl = await sandbox.git.remoteGet(repoPath, 'origin')
    expect(missingUrl).toBeUndefined()

    const daemon = await startGitDaemon(sandbox, baseDir)
    try {
      await sandbox.git.remoteAdd(repoPath, 'origin', daemon.remoteUrl)
      const remoteUrl = await sandbox.git.remoteGet(repoPath, 'origin')
      expect(remoteUrl).toBe(daemon.remoteUrl)
    } finally {
      await daemon.handle.kill()
    }
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
