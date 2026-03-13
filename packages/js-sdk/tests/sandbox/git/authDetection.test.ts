import { describe, expect, test, vi } from 'vitest'

import { GitAuthError } from '../../../src/errors'
import { CommandExitError } from '../../../src/sandbox/commands/commandHandle'
import { Git } from '../../../src/sandbox/git'
import { isAuthFailure } from '../../../src/sandbox/git/utils'

describe('Git auth detection', () => {
  test('does not classify filesystem permission errors as auth failures', () => {
    const err = new CommandExitError({
      exitCode: 128,
      error: "fatal: could not create work tree dir '/home/workspace': Permission denied",
      stdout: '',
      stderr:
        "fatal: could not create work tree dir '/home/workspace': Permission denied",
    })

    expect(isAuthFailure(err)).toBe(false)
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

  test('clone preserves path permission failures instead of raising GitAuthError', async () => {
    const err = new CommandExitError({
      exitCode: 128,
      error: "fatal: could not create work tree dir '/home/workspace': Permission denied",
      stdout: '',
      stderr:
        "fatal: could not create work tree dir '/home/workspace': Permission denied",
    })
    const git = new Git({
      run: vi.fn().mockRejectedValue(err),
    } as any)

    await expect(
      git.clone('https://github.com/e2b-dev/e2b.git', {
        path: '/home/workspace',
      })
    ).rejects.not.toBeInstanceOf(GitAuthError)
    await expect(
      git.clone('https://github.com/e2b-dev/e2b.git', {
        path: '/home/workspace',
      })
    ).rejects.toBe(err)
  })
})
