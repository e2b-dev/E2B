import { expect, test } from 'vitest'
import path from 'node:path'
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
