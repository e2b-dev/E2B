import { expect, test } from 'vitest'
import { matchFileDir } from '../../../src/template/utils'

test('matchFileDir', () => {
  expect(matchFileDir('at /path/to/file.js:1:1')).toBe('/path/to')
})

test('matchFileDir (anonymous)', () => {
  expect(matchFileDir('at <anonymous> (/path/to/file.js:1:1)')).toBe('/path/to')
})
