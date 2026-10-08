import { assert, test } from 'vitest'

import { PatternMatcher } from '../src'

test('matches like .dockerignore', () => {
  const matcher = new PatternMatcher([
    '# comment',
    '',
    'node_modules',
    '/dist/',
    '*.log',
    '**/*.tmp',
    'docs/**',
    '!docs/README.md',
    'src/[a-c]?.ts',
  ])

  assert.isTrue(matcher.matches('node_modules'))
  assert.isTrue(matcher.matches('node_modules/pkg/index.js'))
  assert.isFalse(matcher.matches('src/node_modules'))
  assert.isTrue(matcher.matches('dist'))
  assert.isTrue(matcher.matches('dist/index.js'))
  assert.isTrue(matcher.matches('app.log'))
  assert.isFalse(matcher.matches('logs/app.log'))
  assert.isTrue(matcher.matches('a/b/c.tmp'))
  assert.isTrue(matcher.matches('docs/guide/intro.md'))
  assert.isFalse(matcher.matches('docs/README.md'))
  assert.isFalse(matcher.matches('docs'))
  assert.isTrue(matcher.matches('src/a1.ts'))
  assert.isFalse(matcher.matches('src/d1.ts'))
  assert.isFalse(matcher.matches('src/index.ts'))
})

test('a parent match excludes everything under it', () => {
  const matcher = new PatternMatcher(['build', '!build/keep'])
  assert.isTrue(matcher.matches('build/out.js'))
  assert.isFalse(matcher.matches('build/keep'))
  assert.isFalse(matcher.matches('build/keep/file'))
})

test('mayMatchUnder tells whether an excluded directory must be walked', () => {
  const matcher = new PatternMatcher(['*', '!src/lib/**', '!a/b/c'])
  assert.isTrue(matcher.mayMatchUnder('src'))
  assert.isTrue(matcher.mayMatchUnder('src/lib'))
  assert.isTrue(matcher.mayMatchUnder('a/b'))
  assert.isFalse(matcher.mayMatchUnder('a/b/c'))
  assert.isFalse(matcher.mayMatchUnder('other'))
})

test('cleans patterns like filepath.Clean', () => {
  const matcher = new PatternMatcher([
    './a//b/',
    'c/./d/../e',
    '/f/',
    '../g',
    '/../h',
  ])
  assert.isTrue(matcher.matches('a/b'))
  assert.isTrue(matcher.matches('c/e'))
  assert.isTrue(matcher.matches('f/x'))
  assert.isTrue(matcher.matches('../g'))
  assert.isTrue(matcher.matches('h'))
})

test('backslash escapes by default and separates with backslashIsSeparator', () => {
  assert.isTrue(new PatternMatcher(['a\\*b']).matches('a*b'))
  assert.isFalse(new PatternMatcher(['a\\*b']).matches('a/b'))
  const windows = new PatternMatcher(['a\\*b', 'c\\d'], {
    backslashIsSeparator: true,
  })
  assert.isTrue(windows.matches('a/xb'))
  assert.isTrue(windows.matches('c/d/e'))
})

test('rejects invalid patterns with a plain Error', () => {
  assert.throws(
    () => new PatternMatcher(['[abc']),
    Error,
    "Invalid ignore pattern '[abc'"
  )
  assert.throws(
    () => new PatternMatcher(['[\\q]']),
    Error,
    "Invalid ignore pattern '[\\q]'"
  )
})
