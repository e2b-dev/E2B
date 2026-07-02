import { describe, expect, test } from 'vitest'

import { parseGitStatus } from '../../../src/sandbox/git/utils.js'

describe('parseGitStatus', () => {
    test('malformed branch line with multiple "..." does not crash (issue #1371)', () => {
        const output = '## feat...v2...origin/feat...v2\n'
        // Should not throw; exact parsing is best-effort
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBeDefined()
        expect(status.detached).toBe(false)
    })

    test('upstream branch containing "detached" is not misidentified (issue #1373)', () => {
        const output = '## my-branch...origin/detached-work\n'
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBe('my-branch')
        expect(status.upstream).toBe('origin/detached-work')
        expect(status.detached).toBe(false)
    })

    test('branch literally named "detached" is not treated as detached HEAD', () => {
        const output = '## detached\n'
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBe('detached')
        expect(status.detached).toBe(false)
    })

    test('real detached HEAD is still detected', () => {
        const output = '## HEAD (detached at abc1234)\n'
        const status = parseGitStatus(output)
        expect(status.detached).toBe(true)
    })

    test('branch name containing "detached" substring is not misidentified', () => {
        const output = '## fix-detached-bug...origin/fix-detached-bug\n'
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBe('fix-detached-bug')
        expect(status.upstream).toBe('origin/fix-detached-bug')
        expect(status.detached).toBe(false)
    })

    test('no commits yet parses as branch, not detached', () => {
        const output = '## No commits yet on main\n'
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBe('main')
        expect(status.detached).toBe(false)
    })

    test('HEAD (no branch) is treated as detached', () => {
        const output = '## HEAD (no branch)\n'
        const status = parseGitStatus(output)
        expect(status.detached).toBe(true)
    })

    test('simple branch without upstream', () => {
        const output = '## feature-branch\n'
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBe('feature-branch')
        expect(status.upstream).toBeUndefined()
        expect(status.detached).toBe(false)
    })

    test('empty output returns clean status', () => {
        const status = parseGitStatus('')
        expect(status.currentBranch).toBeUndefined()
        expect(status.detached).toBe(false)
        expect(status.fileStatus).toEqual([])
    })

    test('normal branch with upstream parses correctly', () => {
        const output = '## main...origin/main [ahead 1, behind 2]\n'
        const status = parseGitStatus(output)
        expect(status.currentBranch).toBe('main')
        expect(status.upstream).toBe('origin/main')
        expect(status.ahead).toBe(1)
        expect(status.behind).toBe(2)
        expect(status.detached).toBe(false)
    })
})
