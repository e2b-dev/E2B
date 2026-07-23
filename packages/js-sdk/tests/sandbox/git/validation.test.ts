import { test, expect } from 'vitest'

import { Git } from '../../../src/sandbox/git'
import type { Commands } from '../../../src/sandbox/commands'
import { InvalidArgumentError } from '../../../src/errors'
import { withCredentials } from '../../../src/sandbox/git/utils'

// Stub command runner that fails if a git command is actually executed —
// validation must throw before reaching it.
const failingCommands = {
  run: () => {
    throw new Error('commands.run should not be called')
  },
} as unknown as Commands

test('git.reset throws InvalidArgumentError on an invalid mode', async () => {
  const git = new Git(failingCommands)
  await expect(
    // @ts-expect-error - testing runtime validation with an invalid mode
    git.reset('/repo', { mode: 'bogus' })
  ).rejects.toThrow(InvalidArgumentError)
})

test('git.reset accepts a valid mode', async () => {
  const git = new Git(failingCommands)
  // A valid mode must pass validation and reach the (stubbed) command runner.
  await expect(git.reset('/repo', { mode: 'hard' })).rejects.toThrow(
    'commands.run should not be called'
  )
})

test('git.remoteAdd throws InvalidArgumentError when name or url is missing', async () => {
  const git = new Git(failingCommands)
  await expect(
    git.remoteAdd('/repo', '', 'https://example.com')
  ).rejects.toThrow(InvalidArgumentError)
  await expect(git.remoteAdd('/repo', 'origin', '')).rejects.toThrow(
    InvalidArgumentError
  )
})

test('git.remoteGet throws InvalidArgumentError when name is missing', async () => {
  const git = new Git(failingCommands)
  await expect(git.remoteGet('/repo', '')).rejects.toThrow(InvalidArgumentError)
})

test('withCredentials percent-encodes reserved characters', () => {
  expect(
    withCredentials('https://github.com/o/r.git', 'user', 'p@ss/w:rd')
  ).toBe('https://user:p%40ss%2Fw%3Ard@github.com/o/r.git')
  expect(withCredentials('https://github.com/o/r.git', 'user', 'x#y?z')).toBe(
    'https://user:x%23y%3Fz@github.com/o/r.git'
  )
  expect(withCredentials('https://github.com/o/r.git', 'git', 't/k@n')).toBe(
    'https://git:t%2Fk%40n@github.com/o/r.git'
  )
  expect(
    withCredentials('https://github.com/o/r.git', 'user', 'ghp_AbC123')
  ).toBe('https://user:ghp_AbC123@github.com/o/r.git')
})
