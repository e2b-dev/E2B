import { test, expect } from 'vitest'

import { Git, parseGitLog } from '../../../src/sandbox/git'
import type { Commands } from '../../../src/sandbox/commands'
import { InvalidArgumentError } from '../../../src/errors'

test('parseGitLog parses empty stdout correctly', () => {
  expect(parseGitLog('')).toEqual([])
  expect(parseGitLog('   \n  ')).toEqual([])
})

test('parseGitLog parses formatted commits', () => {
  const stdout = [
    'a1b2c3d4e5f6\x1fAlice Developer\x1falice@example.com\x1f2026-07-16T10:00:00+00:00\x1ffeat: add feature X',
    'f6e5d4c3b2a1\x1fBob Coder\x1fbob@example.com\x1f2026-07-15T15:30:00+00:00\x1ffix: resolve critical bug with spaces',
  ].join('\n')

  const commits = parseGitLog(stdout)
  expect(commits).toHaveLength(2)
  expect(commits[0]).toEqual({
    hash: 'a1b2c3d4e5f6',
    authorName: 'Alice Developer',
    authorEmail: 'alice@example.com',
    date: '2026-07-16T10:00:00+00:00',
    message: 'feat: add feature X',
  })
  expect(commits[1]).toEqual({
    hash: 'f6e5d4c3b2a1',
    authorName: 'Bob Coder',
    authorEmail: 'bob@example.com',
    date: '2026-07-15T15:30:00+00:00',
    message: 'fix: resolve critical bug with spaces',
  })
})

test('git.log throws InvalidArgumentError when maxCount is invalid', async () => {
  const failingCommands = {
    run: () => {
      throw new Error('commands.run should not be called')
    },
  } as unknown as Commands

  const git = new Git(failingCommands)
  await expect(git.log('/repo', { maxCount: 0 })).rejects.toThrow(
    InvalidArgumentError
  )
  await expect(git.log('/repo', { maxCount: -5 })).rejects.toThrow(
    InvalidArgumentError
  )
  await expect(git.log('/repo', { maxCount: NaN })).rejects.toThrow(
    InvalidArgumentError
  )
  await expect(git.log('/repo', { maxCount: Infinity })).rejects.toThrow(
    InvalidArgumentError
  )
  await expect(git.log('/repo', { maxCount: 1.5 })).rejects.toThrow(
    InvalidArgumentError
  )
})

test('git.log returns empty array for unborn branch', async () => {
  const failingCommands = {
    run: async () => {
      const err = new Error('Process exited with code 128') as any
      err.stderr = "fatal: your current branch 'main' does not have any commits yet\n"
      throw err
    },
  } as unknown as Commands

  const git = new Git(failingCommands)
  const commits = await git.log('/repo')
  expect(commits).toEqual([])
})

test('git.log formats args and calls commands.run correctly', async () => {
  let executedCmd = ''
  const mockCommands = {
    run: async (cmd: string) => {
      executedCmd = cmd
      return {
        stdout:
          '1234567\x1fTest User\x1ftest@example.com\x1f2026-07-16T12:00:00Z\x1finitial commit',
        stderr: '',
        exitCode: 0,
      }
    },
  } as unknown as Commands

  const git = new Git(mockCommands)
  const commits = await git.log('/repo/path', { maxCount: 5 })

  expect(executedCmd).toBe(
    'git -C /repo/path log --pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s -n 5'
  )
  expect(commits).toHaveLength(1)
  expect(commits[0].hash).toBe('1234567')
  expect(commits[0].authorName).toBe('Test User')
})
