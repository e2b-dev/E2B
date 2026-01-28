import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  AUTHOR_EMAIL,
  AUTHOR_NAME,
  cleanupBaseDir,
  createBaseDir,
  createRepoWithCommit,
  startGitDaemon,
} from './helpers.js'

sandboxTest('git pull updates clone', async ({ sandbox }) => {
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

      await sandbox.files.write(`${repoPath}/README.md`, 'hello\nmore\n')
      await sandbox.git.add(repoPath, { all: true })
      await sandbox.git.commit(repoPath, 'Update README', {
        authorName: AUTHOR_NAME,
        authorEmail: AUTHOR_EMAIL,
      })
      await sandbox.git.push(repoPath)

      await sandbox.git.pull(clonePath)
      const contents = await sandbox.files.read(`${clonePath}/README.md`)
      expect(contents).toContain('more')
    } finally {
      await daemon.handle.kill()
    }
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
