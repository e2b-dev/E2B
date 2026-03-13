import { describe, expect, test, vi } from 'vitest'

import { GitPermissionError } from '../../../src/errors'
import { CommandExitError } from '../../../src/sandbox/commands/commandHandle'
import { Git } from '../../../src/sandbox/git'
import {
  buildPermissionErrorMessage,
  isAuthFailure,
  isPermissionFailure,
} from '../../../src/sandbox/git/utils'

function createFilesystemPermissionError(stderr: string) {
  return new CommandExitError({
    exitCode: 128,
    error: stderr,
    stdout: '',
    stderr,
  })
}

describe('Git auth detection', () => {
  test('does not classify filesystem permission errors as auth failures', () => {
    const err = createFilesystemPermissionError(
      "fatal: could not create work tree dir '/home/workspace': Permission denied"
    )

    expect(isAuthFailure(err)).toBe(false)
  })

  test('classifies filesystem permission errors separately from auth failures', () => {
    const err = createFilesystemPermissionError(
      'fatal: cannot open .git/FETCH_HEAD: Permission denied'
    )

    expect(isPermissionFailure(err)).toBe(true)
  })

  test('classifies ssh publickey failures as auth failures', () => {
    const err = new CommandExitError({
      exitCode: 128,
      error: 'git@github.com: Permission denied (publickey).',
      stdout: '',
      stderr: 'git@github.com: Permission denied (publickey).',
    })

    expect(isAuthFailure(err)).toBe(true)
  })

  test('clone raises GitPermissionError for path permission failures', async () => {
    const err = createFilesystemPermissionError(
      "fatal: could not create work tree dir '/home/workspace': Permission denied"
    )
    const git = new Git({
      run: vi.fn().mockRejectedValue(err),
    } as any)

    await expect(
      git.clone('https://github.com/e2b-dev/e2b.git', {
        path: '/home/workspace',
      })
    ).rejects.toBeInstanceOf(GitPermissionError)
    await expect(
      git.clone('https://github.com/e2b-dev/e2b.git', {
        path: '/home/workspace',
      })
    ).rejects.toMatchObject({
      message: buildPermissionErrorMessage('clone'),
    })
  })

  test('push raises GitPermissionError for repository write failures', async () => {
    const err = createFilesystemPermissionError(
      "error: unable to create '.git/index.lock': Permission denied"
    )
    const git = new Git({
      run: vi.fn().mockRejectedValue(err),
    } as any)

    await expect(
      git.push('/repo', { remote: 'origin', branch: 'main' })
    ).rejects.toBeInstanceOf(GitPermissionError)
    await expect(
      git.push('/repo', { remote: 'origin', branch: 'main' })
    ).rejects.toMatchObject({
      message: buildPermissionErrorMessage('push'),
    })
  })

  test('pull raises GitPermissionError for repository write failures', async () => {
    const err = createFilesystemPermissionError(
      'error: cannot open .git/FETCH_HEAD: Permission denied'
    )
    const git = new Git({
      run: vi.fn().mockRejectedValue(err),
    } as any)

    await expect(
      git.pull('/repo', { remote: 'origin', branch: 'main' })
    ).rejects.toBeInstanceOf(GitPermissionError)
    await expect(
      git.pull('/repo', { remote: 'origin', branch: 'main' })
    ).rejects.toMatchObject({
      message: buildPermissionErrorMessage('pull'),
    })
  })
})
