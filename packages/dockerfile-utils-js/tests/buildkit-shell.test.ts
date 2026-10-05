import { readFileSync } from 'node:fs'
import { assert, describe, test } from 'vitest'

import { ShellLex } from '../src'

// BuildKit's `frontend/dockerfile/shell` word tables, see
// `fixtures/buildkit/README.md` for how the expectations were generated.

interface LexCase {
  input: string
  word: string | null
  words: string[]
  error?: boolean
}

function loadCases(name: string): LexCase[] {
  const url = new URL(`./fixtures/buildkit/shell/${name}.json`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf-8')) as LexCase[]
}

function check(cases: LexCase[], rawQuotes: boolean) {
  test.each(cases)('$input', ({ input, word, words, error }) => {
    const lex = new ShellLex('\\', { rawQuotes })
    if (error) {
      assert.throws(() => lex.processWord(input))
      assert.throws(() => lex.processWords(input))
      return
    }
    assert.strictEqual(lex.processWord(input), word)
    assert.deepEqual(lex.processWords(input), words)
  })
}

describe('BuildKit shell lexer tables', () => {
  describe('wordsTest', () => {
    check(loadCases('wordsTest'), false)
  })

  describe('wordsTest (RawQuotes)', () => {
    check(loadCases('wordsTest.rawQuotes'), true)
  })

  describe('envVarTest', () => {
    check(loadCases('envVarTest'), false)
  })

  describe('envVarTest (expanded)', () => {
    const env = new Map([
      ['PWD', '/home'],
      ['SHELL', 'bash'],
      ['KOREAN', '한국어'],
      ['NULL', ''],
    ])
    const lex = new ShellLex('\\', { env, skipUnsetEnv: false })
    test.each(loadCases('envVarTest.env'))(
      '$input',
      ({ input, word, error }) => {
        if (error) {
          assert.throws(() => lex.processWord(input))
          return
        }
        assert.strictEqual(lex.processWord(input), word)
      }
    )
  })
})
