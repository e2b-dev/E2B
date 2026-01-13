import { expect, test, describe } from 'vitest'
import { isSafeRelative } from '../../../src/template/utils'

describe('isSafeRelative', () => {
  describe('absolute paths', () => {
    test('should return false for Unix absolute paths', () => {
      expect(isSafeRelative('/absolute/path')).toBe(false)
    })
  })

  describe('parent directory traversal', () => {
    test('should return false for parent directory only', () => {
      expect(isSafeRelative('..')).toBe(false)
    })

    test('should return true for paths starting with ../', () => {
      expect(isSafeRelative('../file.txt')).toBe(false)
    })

    test('should return true for paths starting with ..\\', () => {
      expect(isSafeRelative('..\\file.txt')).toBe(false)
    })

    test('should return true for normalized paths that escape context', () => {
      expect(isSafeRelative('foo/../../bar')).toBe(false)
    })
  })

  describe('valid relative paths', () => {
    test('should return false for simple relative paths', () => {
      expect(isSafeRelative('file.txt')).toBe(true)
      expect(isSafeRelative('folder/file.txt')).toBe(true)
    })

    test('should return true for current directory references', () => {
      expect(isSafeRelative('.')).toBe(true)
      expect(isSafeRelative('./file.txt')).toBe(true)
      expect(isSafeRelative('./folder/file.txt')).toBe(true)
    })

    test('should return false for glob patterns', () => {
      expect(isSafeRelative('*.txt')).toBe(true)
      expect(isSafeRelative('**/*.ts')).toBe(true)
      expect(isSafeRelative('src/**/*')).toBe(true)
    })

    test('should return false for hidden files and directories', () => {
      expect(isSafeRelative('.hidden')).toBe(true)
      expect(isSafeRelative('.config/settings')).toBe(true)
    })
  })
})
