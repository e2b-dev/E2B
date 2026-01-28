import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  AUTHOR_EMAIL,
  AUTHOR_NAME,
  cleanupBaseDir,
  createBaseDir,
  createRepo,
} from './helpers.js'

sandboxTest('git status reports untracked file', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepo(sandbox, baseDir)
    await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')

    const status = await sandbox.git.status(repoPath)
    const entry = status.fileStatus.find(
      (file: any) => file.name === 'README.md'
    )
    expect(entry?.status).toBe('untracked')
    expect(status.isClean).toBe(false)
    expect(status.hasChanges).toBe(true)
    expect(status.hasUntracked).toBe(true)
    expect(status.hasStaged).toBe(false)
    expect(status.hasConflicts).toBe(false)
    expect(status.totalCount).toBe(1)
    expect(status.stagedCount).toBe(0)
    expect(status.unstagedCount).toBe(1)
    expect(status.untrackedCount).toBe(1)
    expect(status.conflictCount).toBe(0)
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest(
  'git status reports added modified deleted renamed',
  async ({ sandbox }) => {
    const baseDir = await createBaseDir(sandbox)

    try {
      const repoPath = await createRepo(sandbox, baseDir)
      await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')
      await sandbox.files.write(`${repoPath}/DELETE.md`, 'delete me\n')
      await sandbox.files.write(`${repoPath}/RENAME.md`, 'rename me\n')
      await sandbox.git.add(repoPath, { all: true })
      await sandbox.git.commit(repoPath, 'Initial commit', {
        authorName: AUTHOR_NAME,
        authorEmail: AUTHOR_EMAIL,
      })

      await sandbox.files.write(`${repoPath}/README.md`, 'hello again\n')
      await sandbox.files.write(`${repoPath}/NEW.md`, 'new file\n')
      await sandbox.git.add(repoPath, { files: ['NEW.md'] })
      await sandbox.commands.run(`git -C "${repoPath}" rm DELETE.md`)
      await sandbox.commands.run(`git -C "${repoPath}" mv RENAME.md RENAMED.md`)

      const status = await sandbox.git.status(repoPath)

      const modified = status.fileStatus.find(
        (file: any) => file.name === 'README.md'
      )
      const added = status.fileStatus.find(
        (file: any) => file.name === 'NEW.md'
      )
      const deleted = status.fileStatus.find(
        (file: any) => file.name === 'DELETE.md'
      )
      const renamed = status.fileStatus.find(
        (file: any) => file.name === 'RENAMED.md'
      )

      expect(modified?.status).toBe('modified')
      expect(modified?.staged).toBe(false)
      expect(added?.status).toBe('added')
      expect(added?.staged).toBe(true)
      expect(deleted?.status).toBe('deleted')
      expect(deleted?.staged).toBe(true)
      expect(renamed?.status).toBe('renamed')
      expect(renamed?.staged).toBe(true)
      expect(renamed?.renamedFrom).toBe('RENAME.md')

      expect(status.hasChanges).toBe(true)
      expect(status.hasStaged).toBe(true)
      expect(status.hasUntracked).toBe(false)
      expect(status.hasConflicts).toBe(false)
      expect(status.totalCount).toBe(4)
      expect(status.stagedCount).toBe(3)
      expect(status.unstagedCount).toBe(1)
      expect(status.untrackedCount).toBe(0)
      expect(status.conflictCount).toBe(0)
    } finally {
      await cleanupBaseDir(sandbox, baseDir)
    }
  }
)
