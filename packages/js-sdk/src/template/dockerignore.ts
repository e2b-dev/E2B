/**
 * Matching of `.dockerignore` patterns, following the semantics Docker uses to
 * filter the build context.
 *
 * Port of the pattern matcher from moby/patternmatcher (Apache-2.0):
 * https://github.com/moby/patternmatcher
 */
import path from 'node:path'
import { TemplateError } from '../errors'

// Characters that have a meaning in a regex but not in a Docker pattern
const LITERAL_REGEX_CHARS = new Set([
  '.',
  '+',
  '(',
  ')',
  '|',
  '{',
  '}',
  '$',
  '^',
])
const WILDCARD_CHARS = /[*?[\\]/
// Evaluated lazily, as `node:path` is not available when loaded in the browser
const backslashIsSeparator = () => path.sep === '\\'

function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

// Escapes that keep their regex meaning in a bracket expression, like in Python
const CLASS_ESCAPES = new Set('dDsSwWfnrtv')
const CLASS_CONTROL_ESCAPES: Record<string, string> = { a: '\\x07', b: '\\x08' }
const CLASS_HEX_ESCAPE_LENGTHS: Record<string, number> = { x: 2, u: 4, U: 8 }
// Characters that must stay escaped in a bracket expression with the `u` flag
const CLASS_SYNTAX_CHARS = new Set('^$\\.*+?()[]{}|/-')

// Make a bracket expression body valid with the regex `u` flag
function translateClass(body: string, backslashIsEscape: boolean): string {
  let cls = ''
  let i = 0
  while (i < body.length) {
    const ch = body[i++]
    if (ch !== '\\') {
      cls += ch
    } else if (!backslashIsEscape || i >= body.length) {
      cls += '\\\\'
    } else {
      const next = body[i++]
      if (CLASS_ESCAPES.has(next)) {
        cls += '\\' + next
      } else if (next in CLASS_CONTROL_ESCAPES) {
        cls += CLASS_CONTROL_ESCAPES[next]
      } else if (next in CLASS_HEX_ESCAPE_LENGTHS) {
        const length = CLASS_HEX_ESCAPE_LENGTHS[next]
        const hex = body.slice(i, i + length)
        if (hex.length < length || !/^[0-9a-fA-F]+$/.test(hex)) {
          throw new Error(`incomplete escape \\${next}${hex}`)
        }
        const code = parseInt(hex, 16)
        if (code > 0x10ffff) {
          throw new Error(`bad escape \\${next}${hex}`)
        }
        cls += `\\u{${code.toString(16)}}`
        i += length
      } else if (/[0-7]/.test(next)) {
        let octal = next
        while (octal.length < 3 && /[0-7]/.test(body[i] ?? '')) {
          octal += body[i++]
        }
        const code = parseInt(octal, 8)
        if (code > 0o377) {
          throw new Error(
            `octal escape value \\${octal} outside of range 0-0o377`
          )
        }
        cls += `\\u{${code.toString(16)}}`
      } else if (/[A-Za-z0-9]/.test(next)) {
        throw new Error(`bad escape \\${next}`)
      } else {
        cls += CLASS_SYNTAX_CHARS.has(next) ? '\\' + next : next
      }
    }
  }
  return cls
}

// Equivalent of Go's filepath.Clean followed by filepath.ToSlash
function clean(pattern: string): string {
  if (backslashIsSeparator()) {
    pattern = pattern.replace(/\\/g, '/')
  }
  return path.posix.normalize(pattern).replace(/(.)\/$/, '$1')
}

type Matcher = (p: string) => boolean

enum MatchType {
  Exact = 'exact',
  Prefix = 'prefix',
  Suffix = 'suffix',
  Regex = 'regex',
}

// Like moby, use plain string checks for patterns without wildcards and only
// fall back to a regex otherwise
function compile(pattern: string): Matcher {
  let regex = '^'
  let matchType = MatchType.Exact
  const n = pattern.length
  const backslashIsEscape = !backslashIsSeparator()
  let i = 0
  while (i < n) {
    const first = i === 0
    const ch = pattern[i++]
    if (ch === '*') {
      if (pattern[i] === '*') {
        i++
        // Treat "**/" as "**"
        if (pattern[i] === '/') {
          i++
        }
        if (i >= n) {
          regex += '.*'
          matchType =
            matchType === MatchType.Exact ? MatchType.Prefix : MatchType.Regex
        } else {
          regex += '(.*/)?'
          matchType = MatchType.Regex
        }
        if (first) {
          matchType = MatchType.Suffix
        }
      } else {
        regex += '[^/]*'
        matchType = MatchType.Regex
      }
    } else if (ch === '?') {
      regex += '[^/]'
      matchType = MatchType.Regex
    } else if (ch === '[') {
      // Copy a bracket expression, a leading "^" negates it
      let j = i
      if (pattern[j] === '^') {
        j++
      }
      while (j < n && pattern[j] !== ']') {
        if (pattern[j] === '\\' && backslashIsEscape) {
          j++
        }
        j++
      }
      regex +=
        '[' +
        translateClass(pattern.slice(i, Math.min(j, n)), backslashIsEscape) +
        (j < n ? ']' : '')
      i = j + 1
      matchType = MatchType.Regex
    } else if (ch === ']') {
      regex += '\\]'
      matchType = MatchType.Regex
    } else if (LITERAL_REGEX_CHARS.has(ch)) {
      regex += '\\' + ch
    } else if (ch === '\\' && backslashIsEscape) {
      // Escape the next character
      if (i < n) {
        regex += escapeRegex(pattern[i++])
        matchType = MatchType.Regex
      } else {
        regex += '\\\\'
      }
    } else {
      regex += ch
    }
  }

  switch (matchType) {
    case MatchType.Exact:
      return (p) => p === pattern
    case MatchType.Prefix: {
      const prefix = pattern.slice(0, -2)
      return (p) => p.startsWith(prefix)
    }
    case MatchType.Suffix: {
      const suffix = pattern.slice(2)
      // "**/foo" also matches "foo"
      return (p) =>
        p.endsWith(suffix) || (suffix[0] === '/' && p === suffix.slice(1))
    }
    case MatchType.Regex: {
      const re = new RegExp(regex + '$', 'u')
      return (p) => re.test(p)
    }
  }
}

interface Pattern {
  exclusion: boolean
  dirs: string[]
  match: Matcher
}

/**
 * Match paths relative to the context root against `.dockerignore` patterns.
 *
 * A pattern that matches a directory excludes everything under it, a leading
 * `/` is ignored, and `!` patterns re-include paths (the last matching
 * pattern wins).
 */
export class PatternMatcher {
  private readonly patterns: Pattern[] = []

  constructor(patterns: string[]) {
    for (const original of patterns) {
      let pattern = original.trim()
      if (!pattern || pattern.startsWith('#')) {
        continue
      }
      const exclusion = pattern.startsWith('!')
      if (exclusion) {
        pattern = pattern.slice(1).trim()
        if (!pattern) {
          continue
        }
      }
      pattern = clean(pattern)
      if (pattern.length > 1 && pattern.startsWith('/')) {
        pattern = pattern.slice(1)
      }
      let match: Matcher
      try {
        match = compile(pattern)
      } catch (err) {
        throw new TemplateError(
          `Invalid ignore pattern '${original}': ${(err as Error).message}`
        )
      }
      this.patterns.push({ exclusion, dirs: pattern.split('/'), match })
    }
  }

  /**
   * Whether the path is excluded. Like BuildKit, the patterns are evaluated
   * on each parent directory first, and a pattern that matched a parent
   * directory also matches the paths under it.
   *
   * @param p Slash-separated path relative to the context root
   * @returns True if the path is excluded
   */
  matches(p: string): boolean {
    const segments = p.split('/')
    let parentMatched: boolean[] = []
    let matched = false
    for (let depth = 1; depth <= segments.length; depth++) {
      const current = segments.slice(0, depth).join('/')
      matched = false
      parentMatched = this.patterns.map((pattern, i) => {
        let match = parentMatched[i] ?? false
        if (!match) {
          // An inclusion can't change an already matched path, and an
          // exclusion can't change a path that hasn't matched yet
          if (pattern.exclusion !== matched) {
            return false
          }
          match = pattern.match(current)
        }
        if (match) {
          matched = !pattern.exclusion
        }
        return match
      })
    }
    return matched
  }

  /**
   * Whether a `!` pattern could re-include a path under the directory,
   * in which case an excluded directory must still be walked.
   *
   * @param dirPath Slash-separated directory path relative to the context root
   * @returns True if a path under the directory could be re-included
   */
  mayMatchUnder(dirPath: string): boolean {
    const dirSegments = dirPath.split('/')
    return this.patterns.some(
      (pattern) =>
        pattern.exclusion && patternMayMatchUnder(pattern, dirSegments)
    )
  }
}

function patternMayMatchUnder(pattern: Pattern, dirSegments: string[]) {
  for (let i = 0; i < dirSegments.length; i++) {
    if (i >= pattern.dirs.length) {
      return false
    }
    const segment = pattern.dirs[i]
    if (segment.includes('**')) {
      return true
    }
    if (!WILDCARD_CHARS.test(segment) && segment !== dirSegments[i]) {
      return false
    }
  }
  return pattern.dirs.length > dirSegments.length
}
