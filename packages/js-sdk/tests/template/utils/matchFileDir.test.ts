import { expect, test } from 'vitest'
import { matchFileDir } from '../../../src/template/utils'

test('matchFileDir', () => {
  expect(matchFileDir('at /path/to/file.js:1:1')).toBe('/path/to')
})

test('matchFileDir (anonymous)', () => {
  expect(matchFileDir('at <anonymous> (/path/to/file.js:1:1)')).toBe('/path/to')
})

test('matchFileDir Windows path', () => {
  expect(matchFileDir('at C:/path/to/file.js:1:1')).toBe('C:/path/to')
})

test('matchFileDir Windows path (anonymous)', () => {
  expect(matchFileDir('at <anonymous> (C:/path/to/file.js:1:1)')).toBe(
    'C:/path/to'
  )
})

test('matchFileDir file:// protocol Windows', () => {
  expect(matchFileDir('at <anonymous> (file:///C:/path/to/file.js:1:1)')).toBe(
    'C:/path/to'
  )
})

test('matchFileDir file:// protocol Windows (no anonymous)', () => {
  expect(matchFileDir('at (file:///C:/path/to/file.js:1:1)')).toBe('C:/path/to')
})
