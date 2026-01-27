import { describe, expect, it } from 'vitest'

import {
  parseGitBranches,
  parseGitStatus,
} from '../../../src/sandbox/git/utils'

describe('git utils', () => {
  it('parses git status output', () => {
    const output =
      '## main...origin/main [ahead 2, behind 1]\n' +
      ' M README.md\n' +
      'A  new.txt\n' +
      'R  old.txt -> renamed.txt\n' +
      '?? untracked.txt\n'

    const status = parseGitStatus(output)

    expect(status.currentBranch).toBe('main')
    expect(status.ahead).toBe(2)
    expect(status.behind).toBe(1)
    expect(status.fileStatus.map((entry) => entry.name)).toEqual([
      'README.md',
      'new.txt',
      'renamed.txt',
      'untracked.txt',
    ])
    expect(status.fileStatus[2].renamedFrom).toBe('old.txt')
  })

  it('preserves leading spaces in porcelain status', () => {
    const output = '## main\n M README.md\n'

    const status = parseGitStatus(output)

    expect(status.fileStatus[0].indexStatus).toBe(' ')
    expect(status.fileStatus[0].workingTreeStatus).toBe('M')
    expect(status.fileStatus[0].staged).toBe(false)
  })

  it('parses git branches output', () => {
    const output = 'main\t*\nfeature\t\n'

    const branches = parseGitBranches(output)

    expect(branches.branches).toEqual(['main', 'feature'])
    expect(branches.currentBranch).toBe('main')
  })
})
