import { execSync } from 'node:child_process'
import { assert, expect } from 'vitest'

import { CommandExitError } from '../../../src'
import { isDebug, sandboxTest } from '../../setup.js'

const containerName = process.env.E2B_DEBUG_ENVD_CONTAINER ?? 'envd'
const gitFailureEnabled = process.env.E2B_DEBUG_GIT_FAILURE !== undefined

const shouldSkip = !isDebug || !gitFailureEnabled
const debugGitTest = sandboxTest.skipIf(shouldSkip)

const gitPath = '/usr/bin/git'
const gitBackupPath = '/usr/bin/git.__e2b_backup__'
const repoPath = '/tmp/e2b-git-debug-repo'

function dockerExec(command: string): string {
  return execSync(
    `docker exec ${containerName} /bin/bash -lc ${JSON.stringify(command)}`,
    {
      encoding: 'utf8',
      stdio: 'pipe',
    }
  )
}

function canExecInContainer(): boolean {
  try {
    dockerExec('true')
    return true
  } catch {
    return false
  }
}

function isGitAvailable(): boolean {
  const result = dockerExec(
    'if command -v git >/dev/null 2>&1; then echo found; else echo missing; fi'
  ).trim()
  return result === 'found'
}

function hideGitBinary(): void {
  dockerExec(
    `if [ -x "${gitPath}" ] && [ ! -e "${gitBackupPath}" ]; then mv "${gitPath}" "${gitBackupPath}"; fi`
  )
}

function restoreGitBinary(): void {
  dockerExec(
    `if [ -e "${gitBackupPath}" ]; then mv "${gitBackupPath}" "${gitPath}"; fi`
  )
}

debugGitTest(
  'git missing surfaces a command exit error (debug-only)',
  async ({ sandbox }) => {
    if (!canExecInContainer()) {
      // No local debug container available.
      return
    }

    if (!isGitAvailable()) {
      // If git is already missing, this test is not meaningful.
      return
    }

    await sandbox.commands.run(
      `rm -rf "${repoPath}" && mkdir -p "${repoPath}" && git -C "${repoPath}" init`
    )

    hideGitBinary()
    assert.equal(
      isGitAvailable(),
      false,
      'expected git to be unavailable in the debug container'
    )

    let caught: unknown
    try {
      await sandbox.git.status(repoPath)
    } catch (err) {
      caught = err
    } finally {
      restoreGitBinary()
    }

    assert.equal(
      isGitAvailable(),
      true,
      'expected git to be restored in the debug container'
    )

    expect(caught).toBeInstanceOf(CommandExitError)
    const exitErr = caught as CommandExitError
    expect(exitErr.exitCode).not.toBe(0)
    expect(exitErr.stderr.toLowerCase()).toContain('command not found')
  }
)
