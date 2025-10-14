import { expect, test } from 'vitest'
import { getCallerDirectory } from '../../../src/template/utils'

test('getCallerDirectory', () => {
  // getCallerDirectory(1) should return the directory of the current file
  // __dirname is the directory of the current file
  expect(getCallerDirectory(1)).toBe(__dirname)
})
