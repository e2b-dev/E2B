import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import {
  cleanupBaseDir,
  createBaseDir,
  createRepoWithCommit,
} from './helpers.js'

sandboxTest('git branches lists current and feature', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.commands.run(`git -C "${repoPath}" branch feature`)

    const branches = await sandbox.git.branches(repoPath)
    expect(branches.currentBranch).toBe('main')
    expect(branches.branches).toContain('main')
    expect(branches.branches).toContain('feature')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest('git checkoutBranch switches branch', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.commands.run(`git -C "${repoPath}" branch feature`)

    await sandbox.git.checkoutBranch(repoPath, 'feature')

    const head = (
      await sandbox.commands.run(
        `git -C "${repoPath}" rev-parse --abbrev-ref HEAD`
      )
    ).stdout.trim()
    expect(head).toBe('feature')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest('git createBranch creates and checks out branch', async ({
  sandbox,
}) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.git.createBranch(repoPath, 'feature')

    const branches = await sandbox.git.branches(repoPath)
    expect(branches.branches).toContain('feature')
    expect(branches.currentBranch).toBe('feature')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})

sandboxTest('git deleteBranch removes branch', async ({ sandbox }) => {
  const baseDir = await createBaseDir(sandbox)

  try {
    const repoPath = await createRepoWithCommit(sandbox, baseDir)
    await sandbox.commands.run(`git -C "${repoPath}" branch feature`)

    await sandbox.git.deleteBranch(repoPath, 'feature', { force: true })

    const branch = (
      await sandbox.commands.run(`git -C "${repoPath}" branch --list feature`)
    ).stdout.trim()
    expect(branch).toBe('')
  } finally {
    await cleanupBaseDir(sandbox, baseDir)
  }
})
