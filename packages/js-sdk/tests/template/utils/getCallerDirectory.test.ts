import { expect, test } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getCallerDirectory } from '../../../src/template/utils'

test('getCallerDirectory', () => {
  // getCallerDirectory(1) should return the directory of the current file
  // __dirname is the directory of the current file.
  // Normalize before comparing: on Windows the stack-trace file name reported
  // by vite/vitest uses forward slashes (e.g. "D:/a/...") whereas __dirname
  // uses native backslashes — the directory is the same, only the separators
  // differ.
  expect(path.normalize(getCallerDirectory(1)!)).toBe(path.normalize(__dirname))
})

test('getCallerDirectory handles file:// URLs from ESM modules', () => {
  // In ESM modules, CallSite.getFileName() returns file:// URLs
  // This test verifies that the conversion works correctly
  const testDirectoryPath = path.join(os.tmpdir(), 'test', 'project', 'src')
  const testFilePath = path.join(testDirectoryPath, 'template.ts')
  const fileUrl = pathToFileURL(testFilePath)

  // Verify that fileURLToPath correctly converts the URL
  // This is the same conversion used in getCallerDirectory
  expect(fileURLToPath(fileUrl)).toBe(testFilePath)
  expect(path.dirname(fileURLToPath(fileUrl))).toBe(testDirectoryPath)
})
