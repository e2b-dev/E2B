import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'

sandboxTest('git add stages files', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')

    await sandbox.git.add(repoPath, { all: true })

    const status = await sandbox.git.status(repoPath)
    const entry = status.fileStatus.find((file: any) => file.name === 'README.md')
    expect(entry?.status).toBe('added')
    expect(entry?.staged).toBe(true)
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
