import { expect, test, describe } from 'vitest'
import { normalizePath } from '../../../src/template/utils'

describe('normalizePath', () => {
  describe('basic path normalization', () => {
    test('should resolve parent directory references', () => {
      expect(normalizePath('/foo/bar/../baz')).toBe('/foo/baz')
    })

    test('should remove current directory references', () => {
      expect(normalizePath('foo/./bar')).toBe('foo/bar')
    })

    test('should collapse multiple slashes', () => {
      expect(normalizePath('foo//bar///baz')).toBe('foo/bar/baz')
    })

    test('should handle multiple parent directory traversals in relative paths', () => {
      expect(normalizePath('../foo/../../bar')).toBe('../../bar')
    })

    test('should not traverse past root for absolute paths', () => {
      expect(normalizePath('/foo/../../bar')).toBe('/bar')
    })

    test('should return dot for empty path', () => {
      expect(normalizePath('')).toBe('.')
    })

    test('should remove leading current directory reference', () => {
      expect(normalizePath('./foo/bar')).toBe('foo/bar')
    })
  })

  describe('Windows paths converted to POSIX style', () => {
    test('should normalize Windows path with drive letter and backslashes', () => {
      expect(normalizePath('C:\\foo\\bar\\..\\baz')).toBe('/foo/baz')
    })

    test('should normalize Windows path with drive letter and forward slashes', () => {
      expect(normalizePath('C:/foo/bar/../baz')).toBe('/foo/baz')
    })

    test('should normalize backslash with current directory reference', () => {
      expect(normalizePath('foo\\.\\bar')).toBe('foo/bar')
    })

    test('should handle backslash parent directory traversal', () => {
      expect(normalizePath('..\\..\\foo')).toBe('../../foo')
    })

    test('should normalize drive letter root to POSIX root', () => {
      expect(normalizePath('C:\\')).toBe('/')
    })
  })

  describe('edge cases', () => {
    test('should return dot for current directory', () => {
      expect(normalizePath('.')).toBe('.')
    })

    test('should handle parent directory only', () => {
      expect(normalizePath('..')).toBe('..')
    })

    test('should handle absolute root path', () => {
      expect(normalizePath('/')).toBe('/')
    })

    test('should handle complex nested path', () => {
      expect(normalizePath('a/b/c/../../d/./e/../f')).toBe('a/d/f')
    })

    test('should preserve trailing segments after parent traversal', () => {
      expect(normalizePath('a/../b/../c')).toBe('c')
    })
  })
})
