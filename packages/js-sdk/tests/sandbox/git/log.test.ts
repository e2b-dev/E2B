import { test, expect } from 'vitest'

import { Git } from '../../../src/sandbox/git'
import type { Commands } from '../../../src/sandbox/commands'
import { parseGitLog } from '../../../src/sandbox/git/utils'

const SAMPLE =
  'abc123\x1fAda Lovelace\x1fada@example.com\x1f2026-07-01T10:00:00+00:00\x1fInitial commit\n' +
  'def456\x1fAlan Turing\x1falan@example.com\x1f2026-07-02T12:30:00+00:00\x1fAdd feature'

test('parseGitLog parses commits', () => {
  expect(parseGitLog(SAMPLE)).toEqual([
    {
      hash: 'abc123',
      authorName: 'Ada Lovelace',
      authorEmail: 'ada@example.com',
      date: '2026-07-01T10:00:00+00:00',
      message: 'Initial commit',
    },
    {
      hash: 'def456',
      authorName: 'Alan Turing',
      authorEmail: 'alan@example.com',
      date: '2026-07-02T12:30:00+00:00',
      message: 'Add feature',
    },
  ])
})

test('parseGitLog handles empty and malformed output', () => {
  expect(parseGitLog('')).toEqual([])
  expect(parseGitLog('no-separators-here')).toEqual([])
})

test('git.log runs git log and returns parsed commits', async () => {
  const commands = {
    run: async () => ({ stdout: SAMPLE, stderr: '', exitCode: 0 }),
  } as unknown as Commands

  const git = new Git(commands)
  const commits = await git.log('/repo', { maxCount: 5 })

  expect(commits).toHaveLength(2)
  expect(commits[0].message).toBe('Initial commit')
  expect(commits[1].authorName).toBe('Alan Turing')
})
