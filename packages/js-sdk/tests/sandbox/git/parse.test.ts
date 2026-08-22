import { expect, test } from 'vitest'

import { parseGitStatus } from '../../../src/sandbox/git/utils'

test('does not treat detached in an upstream name as detached HEAD', () => {
  const status = parseGitStatus('## main...origin/detached-work\n')

  expect(status.currentBranch).toBe('main')
  expect(status.upstream).toBe('origin/detached-work')
  expect(status.detached).toBe(false)
})

test('still detects a detached HEAD', () => {
  const status = parseGitStatus('## HEAD (detached at abc123)\n')

  expect(status.detached).toBe(true)
})
