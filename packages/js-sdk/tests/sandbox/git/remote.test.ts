import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepo,
  startGitDaemon,
} from './helpers.js'

sandboxTest('git remoteGet returns undefined for missing remote', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    const missingUrl = await sandbox.git.remoteGet(repoPath, 'origin')
    expect(missingUrl).toBeUndefined()
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest('git remoteAdd adds remote', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
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

sandboxTest('git remoteAdd overwrites existing remote', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    const daemon = await startGitDaemon(sandbox, baseDir)

    try {
      await sandbox.git.remoteAdd(repoPath, 'origin', daemon.remoteUrl)
      const currentUrl = (
        await sandbox.commands.run(`git -C "${repoPath}" remote get-url origin`)
      ).stdout.trim()
      const currentRemote = await sandbox.git.remoteGet(repoPath, 'origin')
      expect(currentUrl).toBe(daemon.remoteUrl)
      expect(currentRemote).toBe(daemon.remoteUrl)

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
      const updatedRemote = await sandbox.git.remoteGet(repoPath, 'origin')
      expect(updatedUrl).toBe(secondUrl)
      expect(updatedRemote).toBe(secondUrl)
    } finally {
      await daemon.handle.kill()
    }
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
