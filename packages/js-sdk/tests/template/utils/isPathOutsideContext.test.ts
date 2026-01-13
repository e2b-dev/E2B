import { expect, test, describe } from 'vitest'
import { isPathOutsideContext } from '../../../src/template/utils'

describe('isPathOutsideContext', () => {
  describe('absolute paths', () => {
    test('should return true for Unix absolute paths', () => {
      expect(isPathOutsideContext('/absolute/path')).toBe(true)
    })
  })

  describe('parent directory traversal', () => {
    test('should return true for parent directory only', () => {
      expect(isPathOutsideContext('..')).toBe(true)
    })

    test('should return true for paths starting with ../', () => {
      expect(isPathOutsideContext('../file.txt')).toBe(true)
    })

    test('should return true for paths starting with ..\\', () => {
      expect(isPathOutsideContext('..\\file.txt')).toBe(true)
    })

    test('should return true for normalized paths that escape context', () => {
      expect(isPathOutsideContext('foo/../../bar')).toBe(true)
    })
  })

  describe('valid relative paths', () => {
    test('should return false for simple relative paths', () => {
      expect(isPathOutsideContext('file.txt')).toBe(false)
      expect(isPathOutsideContext('folder/file.txt')).toBe(false)
    })

    test('should return false for current directory references', () => {
      expect(isPathOutsideContext('.')).toBe(false)
      expect(isPathOutsideContext('./file.txt')).toBe(false)
      expect(isPathOutsideContext('./folder/file.txt')).toBe(false)
    })

    test('should return false for glob patterns', () => {
      expect(isPathOutsideContext('*.txt')).toBe(false)
      expect(isPathOutsideContext('**/*.ts')).toBe(false)
      expect(isPathOutsideContext('src/**/*')).toBe(false)
    })

    test('should return false for hidden files and directories', () => {
      expect(isPathOutsideContext('.hidden')).toBe(false)
      expect(isPathOutsideContext('.config/settings')).toBe(false)
    })
  })
})
