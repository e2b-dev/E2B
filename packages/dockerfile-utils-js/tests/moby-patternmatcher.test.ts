import { assert, describe, test } from 'vitest'

import { PatternMatcher } from '../src'

// Port of moby/patternmatcher v0.6.1 `patternmatcher_test.go` and
// `ignorefile/ignorefile_test.go`. `Matches`, `MatchesOrParentMatches`,
// `MatchesUsingParentResult(s)` all map to `PatternMatcher.matches`.

function matches(text: string, patterns: string[]): boolean {
  return new PatternMatcher(patterns).matches(text)
}

// [pattern, text, pass]
const matchesTests: [string, string, boolean][] = [
  ['**', 'file', true],
  ['**', 'file/', true],
  ['**/', 'file', true], // weird one
  ['**/', 'file/', true],
  ['**', '/', true],
  ['**/', '/', true],
  ['**', 'dir/file', true],
  ['**/', 'dir/file', true],
  ['**', 'dir/file/', true],
  ['**/', 'dir/file/', true],
  ['**/**', 'dir/file', true],
  ['**/**', 'dir/file/', true],
  ['dir/**', 'dir/file', true],
  ['dir/**', 'dir/file/', true],
  ['dir/**', 'dir/dir2/file', true],
  ['dir/**', 'dir/dir2/file/', true],
  ['**/dir', 'dir', true],
  ['**/dir', 'dir/file', true],
  ['**/dir2/*', 'dir/dir2/file', true],
  ['**/dir2/*', 'dir/dir2/file/', true],
  ['**/dir2/**', 'dir/dir2/dir3/file', true],
  ['**/dir2/**', 'dir/dir2/dir3/file/', true],
  ['**file', 'file', true],
  ['**file', 'dir/file', true],
  ['**/file', 'dir/file', true],
  ['**file', 'dir/dir/file', true],
  ['**/file', 'dir/dir/file', true],
  ['**/file*', 'dir/dir/file', true],
  ['**/file*', 'dir/dir/file.txt', true],
  ['**/file*txt', 'dir/dir/file.txt', true],
  ['**/file*.txt', 'dir/dir/file.txt', true],
  ['**/file*.txt*', 'dir/dir/file.txt', true],
  ['**/**/*.txt', 'dir/dir/file.txt', true],
  ['**/**/*.txt2', 'dir/dir/file.txt', false],
  ['**/*.txt', 'file.txt', true],
  ['**/**/*.txt', 'file.txt', true],
  ['a**/*.txt', 'a/file.txt', true],
  ['a**/*.txt', 'a/dir/file.txt', true],
  ['a**/*.txt', 'a/dir/dir/file.txt', true],
  ['a/*.txt', 'a/dir/file.txt', false],
  ['a/*.txt', 'a/file.txt', true],
  ['a/*.txt**', 'a/file.txt', true],
  ['a[b-d]e', 'ae', false],
  ['a[b-d]e', 'ace', true],
  ['a[b-d]e', 'aae', false],
  ['a[^b-d]e', 'aze', true],
  ['.*', '.foo', true],
  ['.*', 'foo', false],
  ['abc.def', 'abcdef', false],
  ['abc.def', 'abc.def', true],
  ['abc.def', 'abcZdef', false],
  ['abc?def', 'abcZdef', true],
  ['abc?def', 'abcdef', false],
  ['a\\\\', 'a\\', true],
  ['**/foo/bar', 'foo/bar', true],
  ['**/foo/bar', 'dir/foo/bar', true],
  ['**/foo/bar', 'dir/dir2/foo/bar', true],
  ['abc/**', 'abc', false],
  ['abc/**', 'abc/def', true],
  ['abc/**', 'abc/def/ghi', true],
  ['**/.foo', '.foo', true],
  ['**/.foo', 'bar.foo', false],
  ['a(b)c/def', 'a(b)c/def', true],
  ['a(b)c/def', 'a(b)c/xyz', false],
  ['a.|)$(}+{bc', 'a.|)$(}+{bc', true],
  [
    'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
    'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
    true,
  ],
  [
    'dist/*.whl',
    'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
    true,
  ],
  // non-windows only upstream
  ['a\\*b', 'a*b', true],
]

// [patterns, text, pass]
const multiPatternTests: [string[], string, boolean][] = [
  [['**', '!util/docker/web'], 'util/docker/web/foo', false],
  [
    ['**', '!util/docker/web', 'util/docker/web/foo'],
    'util/docker/web/foo',
    true,
  ],
  [
    ['**', '!dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl'],
    'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
    false,
  ],
  [
    ['**', '!dist/*.whl'],
    'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
    false,
  ],
]

// [pattern, s, match, bad pattern]
const matchTests: [string, string, boolean, boolean][] = [
  ['abc', 'abc', true, false],
  ['*', 'abc', true, false],
  ['*c', 'abc', true, false],
  ['a*', 'a', true, false],
  ['a*', 'abc', true, false],
  ['a*', 'ab/c', true, false],
  ['a*/b', 'abc/b', true, false],
  ['a*/b', 'a/c/b', false, false],
  ['a*b*c*d*e*/f', 'axbxcxdxe/f', true, false],
  ['a*b*c*d*e*/f', 'axbxcxdxexxx/f', true, false],
  ['a*b*c*d*e*/f', 'axbxcxdxe/xxx/f', false, false],
  ['a*b*c*d*e*/f', 'axbxcxdxexxx/fff', false, false],
  ['a*b?c*x', 'abxbbxdbxebxczzx', true, false],
  ['a*b?c*x', 'abxbbxdbxebxczzy', false, false],
  ['ab[c]', 'abc', true, false],
  ['ab[b-d]', 'abc', true, false],
  ['ab[e-g]', 'abc', false, false],
  ['ab[^c]', 'abc', false, false],
  ['ab[^b-d]', 'abc', false, false],
  ['ab[^e-g]', 'abc', true, false],
  ['a\\*b', 'a*b', true, false],
  ['a\\*b', 'ab', false, false],
  ['a?b', 'a☺b', true, false],
  ['a[^a]b', 'a☺b', true, false],
  ['a???b', 'a☺b', false, false],
  ['a[^a][^a][^a]b', 'a☺b', false, false],
  ['[a-ζ]*', 'α', true, false],
  ['*[a-ζ]', 'A', false, false],
  ['a?b', 'a/b', false, false],
  ['a*b', 'a/b', false, false],
  ['[\\]a]', ']', true, false],
  ['[\\-]', '-', true, false],
  ['[x\\-]', 'x', true, false],
  ['[x\\-]', '-', true, false],
  ['[x\\-]', 'z', false, false],
  ['[\\-x]', 'x', true, false],
  ['[\\-x]', '-', true, false],
  ['[\\-x]', 'a', false, false],
  ['[]a]', ']', false, true],
  ['[-]', '-', false, true],
  ['[x-]', 'x', false, true],
  ['[x-]', '-', false, true],
  ['[x-]', 'z', false, true],
  ['[-x]', 'x', false, true],
  ['[-x]', '-', false, true],
  ['[-x]', 'a', false, true],
  ['\\', 'a', false, true],
  ['[a-b-c]', 'a', false, true],
  ['[', 'a', false, true],
  ['[^', 'a', false, true],
  ['[^bc', 'a', false, true],
  ['a[', 'a', false, true],
  ['a[', 'ab', false, true],
  ['*x', 'xxx', true, false],
]

describe('moby/patternmatcher', () => {
  test('TestWildcardMatches', () => {
    assert.isTrue(matches('fileutils.go', ['*']))
  })

  test('TestPatternMatches', () => {
    assert.isTrue(matches('fileutils.go', ['*.go']))
  })

  test('TestExclusionPatternMatchesPatternBefore', () => {
    assert.isTrue(matches('fileutils.go', ['!fileutils.go', '*.go']))
  })

  test('TestPatternMatchesFolderExclusions', () => {
    assert.isFalse(matches('docs/README.md', ['docs', '!docs/README.md']))
  })

  test('TestPatternMatchesFolderWithSlashExclusions', () => {
    assert.isFalse(matches('docs/README.md', ['docs/', '!docs/README.md']))
  })

  test('TestPatternMatchesFolderWildcardExclusions', () => {
    assert.isFalse(matches('docs/README.md', ['docs/*', '!docs/README.md']))
  })

  test('TestExclusionPatternMatchesPatternAfter', () => {
    assert.isFalse(matches('fileutils.go', ['*.go', '!fileutils.go']))
  })

  test('TestExclusionPatternMatchesWholeDirectory', () => {
    assert.isFalse(matches('.', ['*.go']))
  })

  test('TestSingleExclamationError', () => {
    assert.throws(() => matches('fileutils.go', ['!']), /illegal exclusion/)
  })

  test('TestMatchesWithNoPatterns', () => {
    assert.isFalse(matches('/any/path/there', []))
  })

  test('TestMatchesWithMalformedPatterns', () => {
    assert.throws(() => matches('/any/path/there', ['[']))
  })

  describe('TestMatches', () => {
    test.each(matchesTests)('%j matches %j -> %s', (pattern, text, pass) => {
      assert.strictEqual(matches(text, [pattern]), pass)
    })

    test.each(multiPatternTests)(
      '%j matches %j -> %s',
      (patterns, text, pass) => {
        assert.strictEqual(matches(text, patterns), pass)
      }
    )

    // Upstream runs the same table on Windows, where `filepath.Clean` turns
    // the slashes into backslashes
    const windowsTests = matchesTests.filter(([p]) => !p.includes('\\'))
    test.each(windowsTests)(
      'windows: %j matches %j -> %s',
      (pattern, text, pass) => {
        const matcher = new PatternMatcher([pattern.replaceAll('/', '\\')], {
          backslashIsSeparator: true,
        })
        assert.strictEqual(matcher.matches(text.replaceAll('/', '\\')), pass)
      }
    )
  })

  test('TestCleanPatterns', () => {
    assert.lengthOf(new PatternMatcher(['docs', 'config']).patterns, 2)
  })

  test('TestCleanPatternsStripEmptyPatterns', () => {
    assert.lengthOf(new PatternMatcher(['docs', 'config', '']).patterns, 2)
  })

  test('TestCleanPatternsExceptionFlag', () => {
    const matcher = new PatternMatcher(['docs', '!docs/README.md'])
    assert.deepEqual(matcher.patterns, ['docs', '!docs/README.md'])
  })

  test('TestCleanPatternsLeadingSpaceTrimmed', () => {
    const matcher = new PatternMatcher(['docs', '  !docs/README.md'])
    assert.deepEqual(matcher.patterns, ['docs', '!docs/README.md'])
  })

  test('TestCleanPatternsTrailingSpaceTrimmed', () => {
    const matcher = new PatternMatcher(['docs', '!docs/README.md  '])
    assert.deepEqual(matcher.patterns, ['docs', '!docs/README.md'])
  })

  test('TestCleanPatternsErrorSingleException', () => {
    assert.throws(() => new PatternMatcher(['!']), /illegal exclusion/)
  })

  describe('TestMatch', () => {
    test.each(matchTests)(
      '%j matches %j -> %s (bad pattern: %s)',
      (pattern, s, match, bad) => {
        if (bad) {
          assert.throws(() => new PatternMatcher([pattern]), /syntax error/)
          return
        }
        assert.strictEqual(matches(s, [pattern]), match)
      }
    )

    // On Windows upstream skips the patterns containing backslashes
    const windowsTests = matchTests.filter(([p]) => !p.includes('\\'))
    test.each(windowsTests)(
      'windows: %j matches %j -> %s (bad pattern: %s)',
      (pattern, s, match, bad) => {
        const create = () =>
          new PatternMatcher([pattern.replaceAll('/', '\\')], {
            backslashIsSeparator: true,
          })
        if (bad) {
          assert.throws(create, /syntax error/)
          return
        }
        assert.strictEqual(create().matches(s.replaceAll('/', '\\')), match)
      }
    )
  })

  test('TestMatchesOrParentMatchesMalformedPatternDoesNotPanicOnRepeatedCall', () => {
    // Upstream only fails when matching; the patterns are compiled upfront
    // here so the bad range is reported when the matcher is created
    assert.throws(() => new PatternMatcher(['[Local-Only]/']))
    assert.throws(() => new PatternMatcher(['[Local-Only]/']))
  })

  test('ignorefile TestReadAll', () => {
    const content = [
      'test1',
      '/test2',
      '/a/file/here',
      '',
      'lastfile',
      '# this is a comment',
      ' # not a comment',
      '! /inverted/abs/path',
    ]
    assert.deepEqual(new PatternMatcher(content).patterns, [
      'test1',
      'test2',
      'a/file/here',
      'lastfile',
      '# not a comment',
      '!inverted/abs/path',
    ])
    // Upstream `ReadAll` keeps `!` and `! ` as `!`, which `New` then rejects
    assert.throws(() => new PatternMatcher([...content, '!']))
    assert.throws(() => new PatternMatcher([...content, '! ']))
  })
})
