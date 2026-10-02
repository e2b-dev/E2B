/**
 * Shell-style word lexer for Dockerfile instruction arguments.
 *
 * This is a port of BuildKit's `frontend/dockerfile/shell` lexer
 * (https://github.com/moby/buildkit) with one difference: variable
 * references (`$VAR`, `${VAR:-default}`, ...) are never expanded and are
 * kept verbatim, so they can be evaluated later inside the sandbox.
 */

const EOF = null

/** Equivalent of Go's `unicode.IsSpace`. */
export function isSpace(ch: string): boolean {
  return /^[\t\n\v\f\r \u0085\u00a0\p{Z}]$/u.test(ch)
}

function isLetter(ch: string): boolean {
  return /^\p{L}$/u.test(ch)
}

function isDigit(ch: string): boolean {
  return /^\p{Nd}$/u.test(ch)
}

function isSpecialParam(ch: string): boolean {
  return '@*#?-$!0'.includes(ch)
}

class Scanner {
  private readonly chars: string[]
  private pos = 0

  constructor(input: string) {
    this.chars = Array.from(input)
  }

  peek(): string | null {
    return this.pos < this.chars.length ? this.chars[this.pos] : EOF
  }

  next(): string | null {
    return this.pos < this.chars.length ? this.chars[this.pos++] : EOF
  }
}

class Words {
  private words: string[] = []
  private buf = ''
  private inWord = false

  addChar(ch: string) {
    if (isSpace(ch) && this.inWord) {
      if (this.buf.length !== 0) {
        this.words.push(this.buf)
        this.buf = ''
        this.inWord = false
      }
    } else if (!isSpace(ch)) {
      this.addRawChar(ch)
    }
  }

  addRawChar(ch: string) {
    this.buf += ch
    this.inWord = true
  }

  addString(str: string) {
    for (const ch of str) {
      this.addChar(ch)
    }
  }

  addRawString(str: string) {
    this.buf += str
    this.inWord = true
  }

  getWords(): string[] {
    if (this.buf.length > 0) {
      this.words.push(this.buf)
      this.buf = ''
      this.inWord = false
    }
    return this.words
  }
}

export interface ShellLexOptions {
  /** Keep quote characters in the output instead of removing them. */
  rawQuotes?: boolean
  /** Keep escape characters in the output instead of removing them. */
  rawEscapes?: boolean
  /** Do not treat quote characters specially at all. */
  skipProcessQuotes?: boolean
}

export class ShellLex {
  private readonly escapeToken: string
  private readonly rawQuotes: boolean
  private readonly rawEscapes: boolean
  private readonly skipProcessQuotes: boolean

  constructor(escapeToken: string, options: ShellLexOptions = {}) {
    this.escapeToken = escapeToken
    this.rawQuotes = options.rawQuotes ?? false
    this.rawEscapes = options.rawEscapes ?? false
    this.skipProcessQuotes = options.skipProcessQuotes ?? false
  }

  /** Process a single word: remove quotes/escapes, keep whitespace. */
  processWord(word: string): string {
    return this.process(word).result
  }

  /** Process a line into whitespace separated words, honoring quotes. */
  processWords(word: string): string[] {
    return this.process(word).words
  }

  private process(word: string): { result: string; words: string[] } {
    const sw = new ShellWord(
      new Scanner(word),
      this.escapeToken,
      this.rawQuotes,
      this.rawEscapes,
      this.skipProcessQuotes
    )
    try {
      return sw.processStopOn(EOF, this.rawEscapes)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`failed to process ${JSON.stringify(word)}: ${message}`)
    }
  }
}

class ShellWord {
  constructor(
    private readonly scanner: Scanner,
    private readonly escapeToken: string,
    private readonly rawQuotes: boolean,
    private rawEscapes: boolean,
    private readonly skipProcessQuotes: boolean
  ) {}

  processStopOn(
    stopChar: string | null,
    rawEscapes: boolean
  ): { result: string; words: string[] } {
    let result = ''
    const words = new Words()

    const previousRawEscapes = this.rawEscapes
    this.rawEscapes = rawEscapes
    try {
      while (this.scanner.peek() !== EOF) {
        let ch = this.scanner.peek() as string

        if (stopChar !== EOF && ch === stopChar) {
          this.scanner.next()
          return { result, words: words.getWords() }
        }

        const fn = this.specialHandler(ch)
        if (fn) {
          const tmp = fn()
          result += tmp
          if (ch === '$') {
            words.addString(tmp)
          } else {
            words.addRawString(tmp)
          }
          continue
        }

        ch = this.scanner.next() as string
        if (ch === this.escapeToken) {
          if (this.rawEscapes) {
            words.addRawChar(ch)
            result += ch
          }

          // the escape token escapes the next character, except at end of line
          const next = this.scanner.next()
          if (next === EOF) {
            break
          }
          ch = next
          words.addRawChar(ch)
        } else {
          words.addChar(ch)
        }
        result += ch
      }
    } finally {
      this.rawEscapes = previousRawEscapes
    }

    if (stopChar !== EOF) {
      throw new Error(
        `unexpected end of statement while looking for matching ${stopChar}`
      )
    }
    return { result, words: words.getWords() }
  }

  private specialHandler(ch: string): (() => string) | undefined {
    switch (ch) {
      case '$':
        return () => this.processDollar()
      case '<':
        return () => this.processPossibleHeredoc()
      case "'":
        return this.skipProcessQuotes
          ? undefined
          : () => this.processSingleQuote()
      case '"':
        return this.skipProcessQuotes
          ? undefined
          : () => this.processDoubleQuote()
      default:
        return undefined
    }
  }

  private processSingleQuote(): string {
    // All chars between single quotes are taken as-is; a single quote
    // cannot be escaped inside single quotes.
    let result = ''
    let ch = this.scanner.next() as string
    if (this.rawQuotes) {
      result += ch
    }

    for (;;) {
      const next = this.scanner.next()
      if (next === EOF) {
        throw new Error(
          'unexpected end of statement while looking for matching single-quote'
        )
      }
      ch = next
      if (ch === "'") {
        if (this.rawQuotes) {
          result += ch
        }
        return result
      }
      result += ch
    }
  }

  private processDoubleQuote(): string {
    // All chars up to the next " are taken as-is, even ', except `$`.
    // The escape token only escapes `"`, `$` and itself.
    let result = ''
    const open = this.scanner.next() as string
    if (this.rawQuotes) {
      result += open
    }

    for (;;) {
      const peeked = this.scanner.peek()
      if (peeked === EOF) {
        throw new Error(
          'unexpected end of statement while looking for matching double-quote'
        )
      }
      if (peeked === '"') {
        const ch = this.scanner.next() as string
        if (this.rawQuotes) {
          result += ch
        }
        return result
      }
      if (peeked === '$') {
        result += this.processDollar()
        continue
      }

      let ch = this.scanner.next() as string
      if (ch === this.escapeToken) {
        if (this.rawEscapes) {
          result += ch
        }
        const after = this.scanner.peek()
        if (after === EOF) {
          // ignore escape token at end of word
          continue
        }
        if (after === '"' || after === '$' || after === this.escapeToken) {
          ch = this.scanner.next() as string
        }
      }
      result += ch
    }
  }

  /**
   * Variable references are preserved verbatim (BuildKit's `SkipUnsetEnv`
   * behaviour with an empty environment), but their syntax is validated.
   */
  private processDollar(): string {
    this.scanner.next() // '$'

    if (this.scanner.peek() !== '{') {
      const name = this.processName()
      if (name === '') {
        return '$'
      }
      return '$' + name
    }

    this.scanner.next() // '{'
    const first = this.scanner.peek()
    if (first === EOF) {
      throw new Error("syntax error: missing '}'")
    }
    if (first === '{' || first === '}' || first === ':') {
      throw new Error('syntax error: bad substitution')
    }

    const name = this.processName()
    let ch = this.scanner.next()
    if (ch === EOF) {
      throw new Error("syntax error: missing '}'")
    }
    let chs = ch

    if (ch === '}') {
      return `\${${name}}`
    }

    let nullIsUnset = false
    if (ch === ':') {
      nullIsUnset = true
      const modifier = this.scanner.next()
      if (modifier === EOF) {
        throw new Error("syntax error: missing '}'")
      }
      ch = modifier
      chs += ch
    }

    if (!nullIsUnset) {
      if (ch === '/') {
        return this.processDollarReplace(name)
      }
      if (!'+-?#%'.includes(ch)) {
        throw new Error(`unsupported modifier (${chs}) in substitution`)
      }
    }

    const rawEscapes = ch === '#' || ch === '%'
    if (nullIsUnset && rawEscapes) {
      throw new Error(`unsupported modifier (${chs}) in substitution`)
    }
    const word = this.processStopOnOrMissingBrace('}', rawEscapes)
    return `\${${name}${chs}${word}}`
  }

  private processDollarReplace(name: string): string {
    let op = '/'
    if (this.scanner.peek() === '/') {
      this.scanner.next()
      op = '//'
    }
    let pattern: string
    try {
      pattern = this.processStopOn('/', true).result
    } catch (err) {
      if (this.scanner.peek() === EOF) {
        throw new Error("syntax error: missing '/' in ${}")
      }
      throw err
    }
    const replacement = this.processStopOnOrMissingBrace('}', true)
    return `\${${name}${op}${pattern}/${replacement}}`
  }

  private processStopOnOrMissingBrace(
    stopChar: string,
    rawEscapes: boolean
  ): string {
    try {
      return this.processStopOn(stopChar, rawEscapes).result
    } catch (err) {
      if (this.scanner.peek() === EOF) {
        throw new Error("syntax error: missing '}'")
      }
      throw err
    }
  }

  private processName(): string {
    // Read in a name (alphanumeric or _). A leading digit sequence or a
    // special parameter character is a complete name on its own.
    let name = ''
    for (;;) {
      const ch = this.scanner.peek()
      if (ch === EOF) {
        break
      }
      if (name.length === 0 && isDigit(ch)) {
        let digits = ''
        for (;;) {
          const d = this.scanner.peek()
          if (d === EOF || !isDigit(d)) {
            break
          }
          digits += this.scanner.next() as string
        }
        return digits
      }
      if (name.length === 0 && isSpecialParam(ch)) {
        return this.scanner.next() as string
      }
      if (!isLetter(ch) && !isDigit(ch) && ch !== '_') {
        break
      }
      name += this.scanner.next() as string
    }
    return name
  }

  private processPossibleHeredoc(): string {
    this.scanner.next() // '<'
    if (this.scanner.peek() !== '<') {
      return '<'
    }
    this.scanner.next()

    // a heredoc may have whitespace between `<<` and the terminator word
    let space = ''
    for (;;) {
      const ch = this.scanner.peek()
      if (ch !== '\t' && ch !== '\r' && ch !== ' ') {
        break
      }
      space += this.scanner.next() as string
    }
    return '<<' + space
  }
}
