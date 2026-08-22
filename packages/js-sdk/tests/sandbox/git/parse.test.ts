import { expect, test } from 'vitest'

import { parseGitStatus } from '../../../src/sandbox/git/utils'

test('does not treat detached in an upstream name as detached HEAD', () => {
  const status = parseGitStatus('## main...origin/detached-work\n')

  expect(status.currentBranch).toBe('main')
  expect(status.upstream).toBe('origin/detached-work')
  expect(status.detached).toBe(false)
})

test('does not treat a branch beginning with HEAD as detached HEAD', () => {
  const status = parseGitStatus(
    '## HEADless-refactor...origin/HEADless-refactor\n'
  )

  expect(status.currentBranch).toBe('HEADless-refactor')
  expect(status.upstream).toBe('origin/HEADless-refactor')
  expect(status.detached).toBe(false)
})

test('still detects a detached HEAD', () => {
  const status = parseGitStatus('## HEAD (detached at abc123)\n')

  expect(status.detached).toBe(true)
})

test('detects a detached HEAD with no branch', () => {
  const status = parseGitStatus('## HEAD (no branch)\n')

  expect(status.detached).toBe(true)
})
