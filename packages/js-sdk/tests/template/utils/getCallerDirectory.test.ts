import { expect, test } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getCallerDirectory, getCallerFrame } from '../../../src/template/utils'

test('getCallerDirectory', () => {
  // getCallerDirectory should return the directory of the first frame outside
  // the SDK — here, the current file.
  // Normalize before comparing: on Windows the stack-trace file name reported
  // by vite/vitest uses forward slashes (e.g. "D:/a/...") whereas __dirname
  // uses native backslashes — the directory is the same, only the separators
  // differ.
  expect(path.normalize(getCallerDirectory()!)).toBe(path.normalize(__dirname))
})

test('getCallerFrame starts at the first frame outside the SDK', () => {
  const stackTrace = getCallerFrame()
  expect(stackTrace).toBeDefined()
  // The first returned frame must be this test file, no matter how many
  // SDK-internal (or transpiler-injected) frames sit above it.
  const firstFrame = stackTrace!.split('\n')[0]
  expect(firstFrame).toContain(path.basename(__filename))
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
