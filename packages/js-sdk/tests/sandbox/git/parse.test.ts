import { test, expect } from 'vitest'

import { parseGitStatus } from '../../../src/sandbox/git/utils'

test('upstream branch containing the word "detached" is not reported as detached', () => {
  // Regression test for e2b-dev/E2B#1373: a repository tracking an upstream
  // branch whose name merely contains the substring "detached" (e.g.
  // origin/detached-work) must not be reported as being in detached HEAD
  // state.
  const status = parseGitStatus('## main...origin/detached-work\n')

  expect(status.detached).toBe(false)
  expect(status.currentBranch).toBe('main')
  expect(status.upstream).toBe('origin/detached-work')
})

test('real detached HEAD is still detected', () => {
  const status = parseGitStatus('## HEAD (detached at abc1234)\n')

  expect(status.detached).toBe(true)
  expect(status.currentBranch).toBeUndefined()
  expect(status.upstream).toBeUndefined()
})

test('HEAD (no branch) is still detected as detached', () => {
  const status = parseGitStatus('## HEAD (no branch)\n')

  expect(status.detached).toBe(true)
})

test('branch name containing an extra "..." does not get truncated', () => {
  // Regression test for e2b-dev/E2B#1371: a normalized branch header
  // containing more than one "..." separator must only split on the first
  // occurrence, not silently drop the rest of the upstream name.
  const status = parseGitStatus('## feat...v2...origin/feat...v2\n')

  expect(status.currentBranch).toBe('feat')
  expect(status.upstream).toBe('v2...origin/feat...v2')
})

test('ahead/behind counts are still parsed', () => {
  const status = parseGitStatus('## main...origin/main [ahead 2, behind 1]\n')

  expect(status.currentBranch).toBe('main')
  expect(status.upstream).toBe('origin/main')
  expect(status.ahead).toBe(2)
  expect(status.behind).toBe(1)
  expect(status.detached).toBe(false)
})
