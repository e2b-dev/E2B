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
const LITERAL_REGEX_CHARS = new Set(['.', '+', '(', ')', '|', '{', '}', '$'])
const WILDCARD_CHARS = /[*?[\\]/
const BACKSLASH_IS_SEPARATOR = path.sep === '\\'

function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
}

// Equivalent of Go's filepath.Clean followed by filepath.ToSlash
function clean(pattern: string): string {
  if (BACKSLASH_IS_SEPARATOR) {
    pattern = pattern.replace(/\\/g, '/')
  }
  return path.posix.normalize(pattern).replace(/(.)\/$/, '$1')
}

function compile(pattern: string): RegExp {
  let regex = '^'
  const n = pattern.length
  let i = 0
  while (i < n) {
    const ch = pattern[i++]
    if (ch === '*') {
      if (pattern[i] === '*') {
        i++
        // Treat "**/" as "**"
        if (pattern[i] === '/') {
          i++
        }
        regex += i >= n ? '.*' : '(.*/)?'
      } else {
        regex += '[^/]*'
      }
    } else if (ch === '?') {
      regex += '[^/]'
    } else if (LITERAL_REGEX_CHARS.has(ch)) {
      regex += '\\' + ch
    } else if (ch === '\\' && !BACKSLASH_IS_SEPARATOR) {
      // Escape the next character
      if (i < n) {
        regex += escapeRegex(pattern[i++])
      } else {
        regex += '\\\\'
      }
    } else {
      regex += ch
    }
  }
  return new RegExp(regex + '$')
}

interface Pattern {
  exclusion: boolean
  dirs: string[]
  regex: RegExp
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
      let regex: RegExp
      try {
        regex = compile(pattern)
      } catch (err) {
        throw new TemplateError(
          `Invalid ignore pattern '${original}': ${(err as Error).message}`
        )
      }
      this.patterns.push({ exclusion, dirs: pattern.split('/'), regex })
    }
  }

  /**
   * Whether the path or one of its parent directories is excluded.
   *
   * @param p Slash-separated path relative to the context root
   * @returns True if the path is excluded
   */
  matches(p: string): boolean {
    const parentPath = path.posix.dirname(p)
    const parentDirs = parentPath === '.' ? [] : parentPath.split('/')

    let matched = false
    for (const pattern of this.patterns) {
      // An inclusion can't change an already matched path, and an
      // exclusion can't change a path that hasn't matched yet
      if (pattern.exclusion !== matched) {
        continue
      }
      const match =
        pattern.regex.test(p) ||
        parentDirs.some((_, i) =>
          pattern.regex.test(parentDirs.slice(0, i + 1).join('/'))
        )
      if (match) {
        matched = !pattern.exclusion
      }
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
