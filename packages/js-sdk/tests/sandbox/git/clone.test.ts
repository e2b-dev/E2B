import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepoWithCommit,
  startGitDaemon,
} from './helpers.js'

sandboxTest('git clone fetches repo', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    const daemon = await startGitDaemon(sandbox, baseDir)
    const clonePath = `${baseDir}/clone`

    try {
      await sandbox.git.remoteAdd(repoPath, 'origin', daemon.remoteUrl)
      await sandbox.git.push(repoPath, {
        remote: 'origin',
        branch: 'main',
        setUpstream: true,
      })

      await sandbox.git.clone(daemon.remoteUrl, { path: clonePath })
      const contents = await sandbox.files.read(`${clonePath}/README.md`)
      expect(contents).toContain('hello')
    } finally {
      await daemon.handle.kill()
    }
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
