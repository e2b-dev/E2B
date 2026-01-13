import { expect, test, describe } from 'vitest'
import { rewriteSrc, toPosixPath } from '../../../src/template/utils'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

describe('rewriteSrc', () => {
  test('should return resolved POSIX path for parent directory paths', () => {
    // Use a real temp directory for cross-platform compatibility
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-src-test-'))
    const contextPath = path.join(tmpdir, 'subdir')
    fs.mkdirSync(contextPath)

    try {
      // ../file.txt from subdir should resolve to tmpdir/file.txt in POSIX format
      const result = rewriteSrc('../file.txt', contextPath)
      const expected = toPosixPath(path.resolve(tmpdir, 'file.txt'))
      expect(result).toBe(expected)

      // ../../file.txt from subdir should resolve to parent of tmpdir in POSIX format
      const result2 = rewriteSrc('../../file.txt', contextPath)
      const expected2 = toPosixPath(path.resolve(tmpdir, '..', 'file.txt'))
      expect(result2).toBe(expected2)
    } finally {
      fs.rmSync(tmpdir, { recursive: true, force: true })
    }
  })

  test('should preserve relative paths', () => {
    const contextPath = path.join('some', 'path')
    expect(rewriteSrc('file.txt', contextPath)).toBe('file.txt')
    expect(rewriteSrc('dir/file.txt', contextPath)).toBe('dir/file.txt')
    expect(rewriteSrc('./file.txt', contextPath)).toBe('./file.txt')
    expect(rewriteSrc('src/components/Button.tsx', contextPath)).toBe(
      'src/components/Button.tsx'
    )
  })

  test('should convert absolute paths to POSIX format', () => {
    const contextPath = path.join('some', 'path')
    // Use platform-appropriate absolute paths
    if (process.platform === 'win32') {
      const absPath = 'C:\\Users\\test\\file.txt'
      // On Windows, absolute paths are converted to POSIX format (no drive letter, forward slashes)
      expect(rewriteSrc(absPath, contextPath)).toBe('Users/test/file.txt')
    } else {
      const absPath = '/usr/local/file.txt'
      // On Unix, leading slash is stripped
      expect(rewriteSrc(absPath, contextPath)).toBe('usr/local/file.txt')
    }
  })

  test('should handle glob patterns', () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-src-test-'))
    const contextPath = path.join(tmpdir, 'subdir')
    fs.mkdirSync(contextPath)

    try {
      expect(rewriteSrc('*.txt', contextPath)).toBe('*.txt')
      expect(rewriteSrc('**/*.py', contextPath)).toBe('**/*.py')

      // ../*.txt from subdir should resolve to tmpdir/*.txt in POSIX format
      const result = rewriteSrc('../*.txt', contextPath)
      const expected = toPosixPath(path.resolve(tmpdir, '*.txt'))
      expect(result).toBe(expected)
    } finally {
      fs.rmSync(tmpdir, { recursive: true, force: true })
    }
  })
})
