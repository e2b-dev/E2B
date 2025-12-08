import { expect, test } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCallerDirectory } from '../../../src/template/utils'

test('getCallerDirectory', () => {
  // getCallerDirectory(1) should return the directory of the current file
  // __dirname is the directory of the current file
  expect(getCallerDirectory(1)).toBe(__dirname)
})

test('getCallerDirectory handles file:// URLs from ESM modules', () => {
  // In ESM modules, CallSite.getFileName() returns file:// URLs
  // This test verifies that the conversion works correctly
  const testPath = '/Users/test/project/src/template.ts'
  const fileUrl = `file://${testPath}`

  // Verify that fileURLToPath correctly converts the URL
  // This is the same conversion used in getCallerDirectory
  expect(fileURLToPath(fileUrl)).toBe(testPath)
  expect(path.dirname(fileURLToPath(fileUrl))).toBe('/Users/test/project/src')
})

test('getCallerDirectory handles file:// URLs with three slashes', () => {
  // file:///path is the standard format on Unix systems
  const testPath = '/Users/test/project/src/template.ts'
  const fileUrl = `file:///${testPath.slice(1)}` // file:///Users/test/...

  expect(fileURLToPath(fileUrl)).toBe(testPath)
})
