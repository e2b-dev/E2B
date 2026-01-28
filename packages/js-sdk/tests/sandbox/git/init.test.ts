import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { cleanupBaseDir, createBaseDir } from './helpers.js'

sandboxTest('git init', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = `${baseDir}/repo`

    await sandbox.git.init(repoPath, { initialBranch: 'main' })

    expect(await sandbox.files.exists(`${repoPath}/.git`)).toBe(true)
    const head = (
      await sandbox.commands.run(
        `git -C "${repoPath}" symbolic-ref --short HEAD`
      )
    ).stdout.trim()
    expect(head).toBe('main')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
