/**
 * Dockerfile syntax parser.
 *
 * Port of BuildKit's `frontend/dockerfile/parser` (https://github.com/moby/buildkit):
 * handles parser directives (`# escape=`), comments, line continuations,
 * builder flags (`--chown=...`), JSON/exec forms and heredocs.
 */

import { ShellLex, isSpace } from './lexer'

export interface DockerfileHeredoc {
  name: string
  /** Raw content including trailing newlines of every line. */
  content: string
  /** `<<-`: leading tabs are stripped from content lines. */
  chomp: boolean
  /** Unquoted terminator: content is subject to variable expansion. */
  expand: boolean
  fileDescriptor: number
}

export interface DockerfileInstruction {
  /** Upper-cased instruction keyword, e.g. `RUN`. */
  name: string
  /** The full (continuation-joined) instruction line. */
  original: string
  /** Builder flags, e.g. `--chown=user:group`, with quotes removed. */
  flags: string[]
  /**
   * Instruction arguments. For `ENV` and `LABEL` these are
   * `[key, value, delimiter, ...]` triples where delimiter is `=` or ``.
   */
  args: string[]
  /** Arguments were given in JSON (exec) form. */
  json: boolean
  heredocs: DockerfileHeredoc[]
  startLine: number
  endLine: number
}

export interface DockerfileWarning {
  message: string
  line: number
}

export interface DockerfileAst {
  instructions: DockerfileInstruction[]
  escapeToken: string
  warnings: DockerfileWarning[]
}

export class DockerfileSyntaxError extends Error {
  constructor(
    message: string,
    public readonly line?: number
  ) {
    super(
      line === undefined
        ? `Dockerfile parse error: ${message}`
        : `Dockerfile parse error on line ${line}: ${message}`
    )
    this.name = 'DockerfileSyntaxError'
  }
}

const DEFAULT_ESCAPE_TOKEN = '\\'

function withLine<T>(line: number, fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    if (err instanceof DockerfileSyntaxError) {
      throw err
    }
    throw new DockerfileSyntaxError(
      err instanceof Error ? err.message : String(err),
      line
    )
  }
}
const WHITESPACE = /[\t\v\f\r ]+/
const DIRECTIVE = /^#\s*([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(.+?)\s*$/
const VALID_DIRECTIVES = new Set(['syntax', 'escape', 'check'])
const HEREDOC_INSTRUCTIONS = new Set(['ADD', 'COPY', 'RUN'])

type LineParser = (
  rest: string,
  escapeToken: string
) => { args: string[]; json: boolean }

function trimNewline(line: string): string {
  let end = line.length
  while (end > 0 && (line[end - 1] === '\n' || line[end - 1] === '\r')) {
    end--
  }
  return line.slice(0, end)
}

function trimLeadingWhitespace(line: string): string {
  return line.replace(/^[\t\n\v\f\r \u0085\u00a0\p{Z}]+/u, '')
}

function isComment(line: string): boolean {
  return trimLeadingWhitespace(line).startsWith('#')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Split into lines the way a `bufio.Scanner` with newline-preserving split does. */
function splitLines(content: string): string[] {
  return content.match(/[^\n]*\n|[^\n]+$/g) ?? []
}

class Directives {
  escapeToken = DEFAULT_ESCAPE_TOKEN
  private continuation = this.buildContinuationRegex(DEFAULT_ESCAPE_TOKEN)
  private done = false
  private seen = new Set<string>()

  /** Returns `true` when the line was a parser directive. */
  possibleParserDirective(line: string): boolean {
    if (this.done) {
      return false
    }
    const match = DIRECTIVE.exec(line)
    if (!match) {
      this.done = true
      return false
    }
    const key = match[1].toLowerCase()
    if (!VALID_DIRECTIVES.has(key)) {
      this.done = true
      return false
    }
    if (this.seen.has(key)) {
      throw new Error(`only one ${key} parser directive can be used`)
    }
    this.seen.add(key)
    if (key === 'escape') {
      this.setEscapeToken(match[2])
    }
    return true
  }

  trimContinuation(line: string): { line: string; isEndOfLine: boolean } {
    if (this.continuation.test(line)) {
      return { line: line.replace(this.continuation, '$1'), isEndOfLine: false }
    }
    return { line, isEndOfLine: true }
  }

  private setEscapeToken(token: string) {
    if (token !== '`' && token !== '\\') {
      throw new Error(`invalid escape token '${token}' does not match \` or \\`)
    }
    this.escapeToken = token
    this.continuation = this.buildContinuationRegex(token)
  }

  private buildContinuationRegex(token: string): RegExp {
    const t = escapeRegExp(token)
    // The escape token is a line continuation when it is the last
    // non-whitespace character and not itself escaped.
    return new RegExp(`([^${t}])${t}[ \\t]*$|^${t}[ \\t]*$`)
  }
}

function parseString(rest: string) {
  return { args: rest === '' ? [] : [rest], json: false }
}

function parseIgnore() {
  return { args: [], json: false }
}

function parseStringsWhitespaceDelimited(rest: string) {
  if (rest === '') {
    return { args: [], json: false }
  }
  return { args: rest.split(WHITESPACE), json: false }
}

class NotJsonArrayError extends Error {}
class NotStringArrayError extends Error {}

function parseJSON(rest: string): string[] {
  rest = trimLeadingWhitespace(rest)
  if (!rest.startsWith('[')) {
    throw new NotJsonArrayError()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rest)
  } catch (err) {
    throw new NotJsonArrayError()
  }
  if (!Array.isArray(parsed)) {
    throw new NotJsonArrayError()
  }
  for (const item of parsed) {
    if (typeof item !== 'string') {
      throw new NotStringArrayError('Only strings are supported in JSON arrays')
    }
  }
  return parsed as string[]
}

function parseMaybeJSON(rest: string) {
  if (rest === '') {
    return { args: [], json: false }
  }
  try {
    return { args: parseJSON(rest), json: true }
  } catch (err) {
    if (err instanceof NotStringArrayError) {
      throw err
    }
    return { args: [rest], json: false }
  }
}

function parseMaybeJSONToList(rest: string) {
  try {
    return { args: parseJSON(rest), json: true }
  } catch (err) {
    if (err instanceof NotStringArrayError) {
      throw err
    }
    return parseStringsWhitespaceDelimited(rest)
  }
}

/**
 * Split a line into whitespace separated words, keeping quotes and escape
 * characters in place (they are resolved later by the shell lexer).
 */
export function parseWords(rest: string, escapeToken: string): string[] {
  const chars = Array.from(rest)
  const words: string[] = []
  let phase: 'spaces' | 'word' | 'quote' = 'spaces'
  let quote = ''
  let blankOK = false
  let word = ''

  for (let pos = 0; pos <= chars.length; pos++) {
    const ch = chars[pos]

    if (phase === 'spaces') {
      if (pos === chars.length) {
        break
      }
      if (isSpace(ch)) {
        continue
      }
      phase = 'word'
    }
    if (pos === chars.length) {
      if (blankOK || word.length > 0) {
        words.push(word)
      }
      break
    }
    if (phase === 'word') {
      if (isSpace(ch)) {
        phase = 'spaces'
        if (blankOK || word.length > 0) {
          words.push(word)
        }
        word = ''
        blankOK = false
        continue
      }
      if (ch === "'" || ch === '"') {
        quote = ch
        blankOK = true
        phase = 'quote'
      }
      if (ch === escapeToken) {
        if (pos + 1 === chars.length) {
          continue // skip an escape token at end of line
        }
        // outside quotes an escape token always keeps itself and the
        // following character, even if that character is a quote
        word += ch
        pos++
        word += chars[pos]
        continue
      }
      word += ch
      continue
    }
    // phase === 'quote'
    if (ch === quote) {
      phase = 'word'
    }
    if (ch === escapeToken && quote !== "'") {
      if (pos + 1 === chars.length) {
        phase = 'word'
        continue // skip the escape token at end
      }
      word += ch
      pos++
      word += chars[pos]
      continue
    }
    word += ch
  }

  return words
}

/**
 * Like `parseMaybeJSONToList`, but the shell form is split with quote
 * awareness so that `COPY "my file.txt" /dest/` works (Docker only
 * supports such paths in JSON form).
 */
function parseMaybeJSONToWords(rest: string, escapeToken: string) {
  try {
    return { args: parseJSON(rest), json: true }
  } catch (err) {
    if (err instanceof NotStringArrayError) {
      throw err
    }
    return { args: parseWords(rest, escapeToken), json: false }
  }
}

function parseNameOrNameVal(rest: string, escapeToken: string) {
  return { args: parseWords(rest, escapeToken), json: false }
}

function parseNameVal(key: string): LineParser {
  return (rest, escapeToken) => {
    const words = parseWords(rest, escapeToken)
    if (words.length === 0) {
      return { args: [], json: false }
    }

    // Old format: KEY name value
    if (!words[0].includes('=')) {
      const match = WHITESPACE.exec(rest)
      if (!match) {
        throw new Error(`${key} must have two arguments`)
      }
      const name = rest.slice(0, match.index)
      const value = rest.slice(match.index + match[0].length)
      return { args: [name, value, ''], json: false }
    }

    const args: string[] = []
    for (const word of words) {
      if (!word.includes('=')) {
        throw new Error(
          `Syntax error - can't find = in "${word}". Must be of the form: name=value`
        )
      }
      const index = word.indexOf('=')
      args.push(word.slice(0, index), word.slice(index + 1), '=')
    }
    return { args, json: false }
  }
}

const LINE_PARSERS: Record<string, LineParser> = {
  ADD: parseMaybeJSONToWords,
  ARG: parseNameOrNameVal,
  CMD: parseMaybeJSON,
  COPY: parseMaybeJSONToWords,
  ENTRYPOINT: parseMaybeJSON,
  ENV: parseNameVal('ENV'),
  EXPOSE: parseStringsWhitespaceDelimited,
  FROM: parseStringsWhitespaceDelimited,
  HEALTHCHECK: parseIgnore,
  LABEL: parseNameVal('LABEL'),
  MAINTAINER: parseString,
  ONBUILD: parseIgnore,
  RUN: parseMaybeJSON,
  SHELL: parseMaybeJSON,
  STOPSIGNAL: parseString,
  USER: parseString,
  VOLUME: parseMaybeJSONToList,
  WORKDIR: parseString,
}

/** Parses leading `--flag[=value]` words. Returns the remaining line and flags. */
function extractBuilderFlags(
  line: string,
  escapeToken: string
): { rest: string; flags: string[] } {
  const chars = Array.from(line)
  const flags: string[] = []
  let phase: 'spaces' | 'word' | 'quote' = 'spaces'
  let quote = ''
  let blankOK = false
  let word = ''

  for (let pos = 0; pos <= chars.length; pos++) {
    const ch = chars[pos]

    if (phase === 'spaces') {
      if (pos === chars.length) {
        break
      }
      if (isSpace(ch)) {
        continue
      }
      // only keep going if the next word starts with --
      if (ch !== '-' || pos + 1 === chars.length || chars[pos + 1] !== '-') {
        return { rest: chars.slice(pos).join(''), flags }
      }
      phase = 'word'
    }
    if (pos === chars.length) {
      if (word !== '--' && (blankOK || word.length > 0)) {
        flags.push(word)
      }
      break
    }
    if (phase === 'word') {
      if (isSpace(ch)) {
        phase = 'spaces'
        if (word === '--') {
          return { rest: chars.slice(pos).join(''), flags }
        }
        if (blankOK || word.length > 0) {
          flags.push(word)
        }
        word = ''
        blankOK = false
        continue
      }
      if (ch === "'" || ch === '"') {
        quote = ch
        blankOK = true
        phase = 'quote'
        continue
      }
      if (ch === escapeToken) {
        if (pos + 1 === chars.length) {
          continue
        }
        pos++
        word += chars[pos]
        continue
      }
      word += ch
      continue
    }
    // phase === 'quote'
    if (ch === quote) {
      phase = 'word'
      continue
    }
    if (ch === escapeToken) {
      if (pos + 1 === chars.length) {
        phase = 'word'
        continue
      }
      pos++
      word += chars[pos]
      continue
    }
    word += ch
  }

  return { rest: '', flags }
}

function splitCommand(
  line: string,
  escapeToken: string
): { command: string; flags: string[]; rest: string } {
  const trimmed = line.trim()
  const match = WHITESPACE.exec(trimmed)
  if (!match) {
    return { command: trimmed, flags: [], rest: '' }
  }
  const command = trimmed.slice(0, match.index)
  const { rest, flags } = extractBuilderFlags(
    trimmed.slice(match.index + match[0].length),
    escapeToken
  )
  return { command, flags, rest: rest.trim() }
}

// Matches `^(\d*)<<(-?)\s*([^<]*)$` without a regex, whose adjacent `\s*`
// and `[^<]*` are ambiguous on whitespace runs (polynomial backtracking).
function matchHeredocMarker(
  word: string
): { fileDescriptor: string; chomp: boolean; rest: string } | undefined {
  let i = 0
  while (i < word.length && word[i] >= '0' && word[i] <= '9') {
    i++
  }
  if (!word.startsWith('<<', i)) {
    return undefined
  }
  const fileDescriptor = word.slice(0, i)
  i += 2
  const chomp = word[i] === '-'
  if (chomp) {
    i++
  }
  while (i < word.length && /\s/.test(word[i])) {
    i++
  }
  const rest = word.slice(i)
  if (rest.includes('<')) {
    return undefined
  }
  return { fileDescriptor, chomp, rest }
}

export function parseHeredoc(word: string): DockerfileHeredoc | undefined {
  const match = matchHeredocMarker(word)
  if (!match) {
    return undefined
  }
  const fileDescriptor =
    match.fileDescriptor === '' ? 0 : parseInt(match.fileDescriptor, 10)
  const { chomp, rest } = match
  if (rest.length === 0) {
    return undefined
  }

  // Lex the terminator both with and without quotes. If the results
  // differ, part of the word was quoted and the content must not expand.
  const words = new ShellLex('\\').processWords(rest)
  if (words.length !== 1) {
    return undefined
  }
  const wordsRaw = new ShellLex('\\', { rawQuotes: true }).processWords(rest)
  if (wordsRaw.length !== words.length) {
    throw new Error(
      `internal lexing of heredoc produced inconsistent results: ${rest}`
    )
  }

  const countQuotes = (s: string) =>
    (s.match(/'/g) ?? []).length + (s.match(/"/g) ?? []).length
  const expand = countQuotes(words[0]) === countQuotes(wordsRaw[0])

  return { name: words[0], content: '', chomp, expand, fileDescriptor }
}

function heredocsFromLine(line: string): DockerfileHeredoc[] {
  let words: string[]
  try {
    words = new ShellLex('\\', {
      rawQuotes: true,
      rawEscapes: true,
    }).processWords(line)
  } catch {
    return []
  }
  const heredocs: DockerfileHeredoc[] = []
  for (const word of words) {
    const heredoc = parseHeredoc(word)
    if (heredoc) {
      heredocs.push(heredoc)
    }
  }
  return heredocs
}

/** Strips leading tabs from every line (`<<-` heredocs). */
export function chompHeredocContent(content: string): string {
  return content.replace(/^\t+/gm, '')
}

export function parseDockerfileAst(content: string): DockerfileAst {
  const directives = new Directives()
  const lines = splitLines(content.replace(/^\uFEFF/, ''))
  const instructions: DockerfileInstruction[] = []
  const warnings: DockerfileWarning[] = []

  let currentLine = 0
  let index = 0

  const processLine = (raw: string, stripLeftWhitespace: boolean): string => {
    let line = trimNewline(raw)
    if (stripLeftWhitespace) {
      line = trimLeadingWhitespace(line)
    }
    withLine(currentLine + 1, () => directives.possibleParserDirective(line))
    return isComment(line) ? '' : line
  }

  while (index < lines.length) {
    const raw = lines[index++]
    let line = processLine(raw, true)
    currentLine++
    const startLine = currentLine

    const first = directives.trimContinuation(line)
    line = first.line
    let isEndOfLine = first.isEndOfLine
    if (isEndOfLine && line.length === 0) {
      continue
    }

    let hasEmptyContinuationLine = false
    while (!isEndOfLine && index < lines.length) {
      const continuationRaw = lines[index++]
      const continuation = processLine(continuationRaw, false)
      currentLine++

      if (isComment(continuationRaw)) {
        continue
      }
      if (trimLeadingWhitespace(trimNewline(continuationRaw)).length === 0) {
        hasEmptyContinuationLine = true
        continue
      }

      const trimmed = directives.trimContinuation(continuation)
      isEndOfLine = trimmed.isEndOfLine
      line += trimmed.line
    }

    if (hasEmptyContinuationLine) {
      warnings.push({
        message: `Empty continuation line found in: ${line}`,
        line: currentLine,
      })
    }

    const { command, flags, rest } = splitCommand(line, directives.escapeToken)
    const name = command.toUpperCase()
    const lineParser = LINE_PARSERS[name]
    if (!lineParser) {
      throw new DockerfileSyntaxError(
        `unknown instruction: ${command}`,
        startLine
      )
    }

    const parsed = withLine(startLine, () =>
      lineParser(rest, directives.escapeToken)
    )

    const instruction: DockerfileInstruction = {
      name,
      original: line,
      flags,
      args: parsed.args,
      json: parsed.json,
      heredocs: [],
      startLine,
      endLine: currentLine,
    }

    if (HEREDOC_INSTRUCTIONS.has(name) && !parsed.json && line.includes('<<')) {
      const heredocs = withLine(startLine, () => heredocsFromLine(line))
      for (const heredoc of heredocs) {
        let terminated = false
        while (index < lines.length) {
          const heredocLine = lines[index++]
          currentLine++

          let possibleTerminator = trimNewline(heredocLine)
          if (heredoc.chomp) {
            possibleTerminator = possibleTerminator.replace(/^\t+/, '')
          }
          if (possibleTerminator === heredoc.name) {
            terminated = true
            break
          }
          heredoc.content += heredocLine
        }
        if (!terminated) {
          throw new DockerfileSyntaxError('unterminated heredoc', startLine)
        }
        instruction.heredocs.push(heredoc)
      }
      instruction.endLine = currentLine
    }

    instructions.push(instruction)
  }

  return { instructions, escapeToken: directives.escapeToken, warnings }
}
