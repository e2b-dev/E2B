import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepo,
  startGitDaemon,
} from './helpers.js'

sandboxTest('git remoteAdd overwrite', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    const daemon = await startGitDaemon(sandbox, baseDir)

    try {
      await sandbox.git.remoteAdd(repoPath, 'origin', daemon.remoteUrl)
      const currentUrl = (
        await sandbox.commands.run(`git -C "${repoPath}" remote get-url origin`)
      ).stdout.trim()
      expect(currentUrl).toBe(daemon.remoteUrl)

      const secondPath = `${baseDir}/remote-2.git`
      await sandbox.commands.run(
        `git init --bare --initial-branch=main "${secondPath}"`
      )
      const secondUrl = `git://127.0.0.1:${daemon.port}/remote-2.git`

      await sandbox.git.remoteAdd(repoPath, 'origin', secondUrl, {
        overwrite: true,
      })
      const updatedUrl = (
        await sandbox.commands.run(`git -C "${repoPath}" remote get-url origin`)
      ).stdout.trim()
      expect(updatedUrl).toBe(secondUrl)
    } finally {
      await daemon.handle.kill()
    }
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
