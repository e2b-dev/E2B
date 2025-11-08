import { expect, test } from 'vitest'
import { matchFileDir } from '../../../src/template/utils'

// Basic Unix/Linux paths
test('matchFileDir', () => {
  expect(matchFileDir('at /path/to/file.js:1:1')).toBe('/path/to')
})

test('matchFileDir (anonymous)', () => {
  expect(matchFileDir('at <anonymous> (/path/to/file.js:1:1)')).toBe('/path/to')
})

test('matchFileDir Unix path with spaces', () => {
  expect(matchFileDir('at /home/user/my project/file.js:1:1')).toBe(
    '/home/user/my project'
  )
})

test('matchFileDir Unix path with special characters', () => {
  expect(matchFileDir('at /path/to-my_dir.test/file.js:1:1')).toBe(
    '/path/to-my_dir.test'
  )
})

test('matchFileDir Unix root directory', () => {
  expect(matchFileDir('at /file.js:1:1')).toBe('/')
})

test('matchFileDir Unix path with @symbol (scoped packages)', () => {
  expect(matchFileDir('at /node_modules/@scope/package/index.js:1:1')).toBe(
    '/node_modules/@scope/package'
  )
})

test('matchFileDir Unix path with brackets (Next.js dynamic routes)', () => {
  expect(matchFileDir('at /app/routes/[id]/page.js:1:1')).toBe(
    '/app/routes/[id]'
  )
})

// Basic Windows paths (forward slash)
test('matchFileDir Windows path', () => {
  expect(matchFileDir('at C:/path/to/file.js:1:1')).toBe('C:/path/to')
})

test('matchFileDir Windows path (anonymous)', () => {
  expect(matchFileDir('at <anonymous> (C:/path/to/file.js:1:1)')).toBe(
    'C:/path/to'
  )
})

test('matchFileDir Windows path with spaces', () => {
  expect(matchFileDir('at C:/Program Files/App/index.js:1:1')).toBe(
    'C:/Program Files/App'
  )
})

// File protocol paths
test('matchFileDir file:// protocol Windows', () => {
  expect(matchFileDir('at <anonymous> (file:///C:/path/to/file.js:1:1)')).toBe(
    'C:/path/to'
  )
})

test('matchFileDir file:// protocol Windows (no anonymous)', () => {
  expect(matchFileDir('at (file:///C:/path/to/file.js:1:1)')).toBe('C:/path/to')
})

// Paths with parentheses
test('matchFileDir with parentheses in path', () => {
  expect(matchFileDir('at /path/to(1)/file.js:1:1')).toBe('/path/to(1)')
})

test('matchFileDir with parentheses in path (anonymous)', () => {
  expect(matchFileDir('at <anonymous> (/path/to(1)/file.js:1:1)')).toBe(
    '/path/to(1)'
  )
})
