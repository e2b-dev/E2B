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

interface EnvCase {
  input: string
  env: Record<string, string>
  word?: string
  words?: string[]
  error?: boolean
}

function loadCases<T = LexCase>(name: string): T[] {
  const url = new URL(`./fixtures/buildkit/shell/${name}.json`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf-8')) as T[]
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

  // TestShellParser4Words with the `ENV` lines of `wordsTest` applied
  // cumulatively. Upstream also loops a RawQuotes + SkipUnsetEnv mode, but it
  // re-scans the already exhausted file, so only the normal mode is asserted.
  describe('wordsTest with ENV', () => {
    test.each(loadCases<EnvCase>('wordsTest.env'))(
      '$input',
      ({ input, env, words, error }) => {
        const lex = new ShellLex('\\', {
          env: new Map(Object.entries(env)),
          skipUnsetEnv: false,
        })
        if (error) {
          assert.throws(() => lex.processWords(input))
          return
        }
        assert.deepEqual(lex.processWords(input), words)
      }
    )
  })

  describe('TestProcessWithMatches', () => {
    test.each(loadCases<EnvCase>('processWithMatches'))(
      '$input',
      ({ input, env, word, error }) => {
        const lex = new ShellLex('\\', {
          env: new Map(Object.entries(env)),
          skipUnsetEnv: false,
        })
        if (error) {
          assert.throws(() => lex.processWord(input))
          return
        }
        assert.strictEqual(lex.processWord(input), word)
      }
    )
  })

  test('TestProcessWithMatchesPlatform', () => {
    const release =
      'something-${VERSION}.${TARGETOS}-${TARGETARCH}${TARGETVARIANT:+-${TARGETVARIANT}}.tar.gz'
    const run = (env: Record<string, string>) =>
      new ShellLex('\\', {
        env: new Map(Object.entries(env)),
        skipUnsetEnv: false,
      }).processWord(release)
    const base = { VERSION: 'v1.2.3', TARGETOS: 'linux' }
    assert.equal(
      run({ ...base, TARGETARCH: 'arm', TARGETVARIANT: 'v7' }),
      'something-v1.2.3.linux-arm-v7.tar.gz'
    )
    assert.equal(
      run({ ...base, TARGETARCH: 'arm64', TARGETVARIANT: '' }),
      'something-v1.2.3.linux-arm64.tar.gz'
    )
    assert.equal(
      run({ ...base, TARGETARCH: 'arm64' }),
      'something-v1.2.3.linux-arm64.tar.gz'
    )
  })

  test('TestShellParserMandatoryEnvVars', () => {
    const run = (word: string, env: Record<string, string>) =>
      new ShellLex('\\', {
        env: new Map(Object.entries(env)),
        skipUnsetEnv: false,
      }).processWord(word)
    const set = { VAR: 'plain', ARG: 'x' }
    const empty = { VAR: '', ARG: 'x' }
    const unset = { ARG: 'x' }
    const noEmpty = '${VAR:?message here$ARG}'
    const noUnset = '${VAR?message here$ARG}'

    assert.equal(run(noEmpty, set), 'plain')
    assert.throws(() => run(noEmpty, empty), /message herex/)
    assert.throws(() => run(noEmpty, unset), /message herex/)

    assert.equal(run(noUnset, set), 'plain')
    assert.equal(run(noUnset, empty), '')
    assert.throws(() => run(noUnset, unset), /message herex/)
  })
})
