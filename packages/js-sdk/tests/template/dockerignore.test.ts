import { describe, expect, test } from 'vitest'
import { PatternMatcher } from '../../src/template/dockerignore'

describe('PatternMatcher', () => {
  describe('leading globstar with a literal suffix', () => {
    test.each([
      'a.txt',
      'keep1.txt',
      'src/nested.txt',
      'src/generated/deep.txt',
      'weird\nname\nx.txt',
    ])('matches %s', (path) => {
      expect(new PatternMatcher(['**.txt']).matches(path)).toBe(true)
    })

    test.each(['keep.txt.bak', 'keep1.txtx', 'a.txt\n', 'notes.md'])(
      'does not match %s',
      (path) => {
        expect(new PatternMatcher(['**.txt']).matches(path)).toBe(false)
      }
    )

    test('keeps regex characters in the suffix literal', () => {
      const matcher = new PatternMatcher(['**(1).txt'])
      expect(matcher.matches('root(1).txt')).toBe(true)
      expect(matcher.matches('root1.txt')).toBe(false)
    })

    test('is newline-safe in both directions', () => {
      // A filename can contain newlines; JS '.' does not match them without
      // the dotAll flag, and '$' (without 'm') anchors to the absolute end.
      const matcher = new PatternMatcher(['**.txt'])
      expect(matcher.matches('a\n.txt')).toBe(true)
      expect(matcher.matches('a.txt\n')).toBe(false)
    })
  })
})
