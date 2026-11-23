import { expect, test } from 'vitest'

import { parseGitStatus } from '../../../src/sandbox/git/utils.js'

test('parseGitStatus classifies AA and DD porcelain entries as conflict', () => {
  const output = ['## main', 'AA both-added.ts', 'DD both-deleted.ts'].join(
    '\n'
  )

  const status = parseGitStatus(output)

  expect(status.fileStatus).toMatchObject([
    {
      name: 'both-added.ts',
      status: 'conflict',
      indexStatus: 'A',
      workingTreeStatus: 'A',
      staged: true,
    },
    {
      name: 'both-deleted.ts',
      status: 'conflict',
      indexStatus: 'D',
      workingTreeStatus: 'D',
      staged: true,
    },
  ])
  expect(status.hasConflicts).toBe(true)
  expect(status.conflictCount).toBe(2)
})
