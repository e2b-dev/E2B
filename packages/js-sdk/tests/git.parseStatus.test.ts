import { expect, test } from 'vitest'

import { parseGitStatus } from '../src/sandbox/git/utils'

// Twin of the Python fix in PR #1374 (issue #1373): `parseGitStatus` used to flag
// `detached: true` for any branch/upstream name merely containing the substring
// "detached", dropping `currentBranch`/`upstream` for ordinary branches.

test('upstream whose name contains "detached" is not a detached HEAD', () => {
  // Branch 'main' tracking 'origin/detached-work': NOT a detached HEAD.
  const status = parseGitStatus('## main...origin/detached-work\n')
  expect(status.detached).toBe(false)
  expect(status.currentBranch).toBe('main')
  expect(status.upstream).toBe('origin/detached-work')
})

test('local branch whose name contains "detached" is not a detached HEAD', () => {
  const status = parseGitStatus('## feature/detached-session-fix\n')
  expect(status.detached).toBe(false)
  expect(status.currentBranch).toBe('feature/detached-session-fix')
})

test('real detached HEAD ("## HEAD (no branch)") is still detected', () => {
  const status = parseGitStatus('## HEAD (no branch)\n')
  expect(status.detached).toBe(true)
})

test('real detached HEAD ("## HEAD (detached at <sha>)") is still detected', () => {
  const status = parseGitStatus('## HEAD (detached at 1a2b3c4)\n')
  expect(status.detached).toBe(true)
})
