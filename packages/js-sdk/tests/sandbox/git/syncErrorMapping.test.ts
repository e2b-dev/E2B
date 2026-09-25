import { test as base, expect } from 'vitest'

import { isGitTestsEnabled } from '../../setup.js'
import { Git } from '../../../src/sandbox/git'
import type { Commands } from '../../../src/sandbox/commands'
import {
  CommandExitError,
  CommandResult,
} from '../../../src/sandbox/commands/commandHandle'
import { GitAuthError, GitUpstreamError } from '../../../src/errors'

const test = base.skipIf(!isGitTestsEnabled)

const REMOTE_URL = 'https://github.com/e2b-dev/e2b.git'

function gitExitFailure(stderr: string): CommandExitError {
  return new CommandExitError({ exitCode: 128, stdout: '', stderr })
}

// Fake command runner standing in for the sandbox: every git invocation is
// recorded, the push/pull itself fails with the given error, and the remote
// bookkeeping around it (`remote get-url` / `remote set-url`) succeeds.
function fakeCommands(failure: CommandExitError): {
  commands: Commands
  runCalls: string[]
} {
  const runCalls: string[] = []
  const commands = {
    run: async (cmd: string): Promise<CommandResult> => {
      runCalls.push(cmd)
      if (/\s(push|pull)\b/.test(cmd)) {
        throw failure
      }
      if (cmd.includes(' remote get-url ')) {
        return { exitCode: 0, stdout: `${REMOTE_URL}\n`, stderr: '' }
      }
      return { exitCode: 0, stdout: '', stderr: '' }
    },
  } as unknown as Commands
  return { commands, runCalls }
}

test('git push without credentials maps an auth failure to GitAuthError', async () => {
  const { commands } = fakeCommands(
    gitExitFailure(`fatal: Authentication failed for '${REMOTE_URL}/'`)
  )
  const git = new Git(commands)

  await expect(git.push('/repo', { remote: 'origin' })).rejects.toBeInstanceOf(
    GitAuthError
  )
})

test('git push with username/password maps an auth failure to GitAuthError', async () => {
  const { commands, runCalls } = fakeCommands(
    gitExitFailure(`fatal: Authentication failed for '${REMOTE_URL}/'`)
  )
  const git = new Git(commands)

  await expect(
    git.push('/repo', {
      remote: 'origin',
      username: 'user',
      password: 'expired-token',
    })
  ).rejects.toBeInstanceOf(GitAuthError)

  // The credentials temporarily embedded in the remote URL must be stripped
  // again even when the push fails.
  expect(runCalls[runCalls.length - 1]).toBe(
    `git -C /repo remote set-url origin ${REMOTE_URL}`
  )
})

test('git pull with username/password maps an auth failure to GitAuthError', async () => {
  const { commands } = fakeCommands(
    gitExitFailure(`fatal: Authentication failed for '${REMOTE_URL}/'`)
  )
  const git = new Git(commands)

  await expect(
    git.pull('/repo', {
      remote: 'origin',
      branch: 'main',
      username: 'user',
      password: 'expired-token',
    })
  ).rejects.toBeInstanceOf(GitAuthError)
})

test('git push with username/password maps a missing upstream to GitUpstreamError', async () => {
  const { commands } = fakeCommands(
    gitExitFailure(
      'fatal: The current branch main has no upstream branch.\n' +
        'To push the current branch and set the remote as upstream, use\n\n' +
        '    git push --set-upstream origin main'
    )
  )
  const git = new Git(commands)

  await expect(
    git.push('/repo', {
      remote: 'origin',
      setUpstream: false,
      username: 'user',
      password: 'token',
    })
  ).rejects.toBeInstanceOf(GitUpstreamError)
})

test('git pull with username/password maps a missing upstream to GitUpstreamError', async () => {
  const { commands } = fakeCommands(
    gitExitFailure(
      'There is no tracking information for the current branch.\n' +
        'Please specify which branch you want to merge with.'
    )
  )
  const git = new Git(commands)

  await expect(
    git.pull('/repo', {
      remote: 'origin',
      username: 'user',
      password: 'token',
    })
  ).rejects.toBeInstanceOf(GitUpstreamError)
})
