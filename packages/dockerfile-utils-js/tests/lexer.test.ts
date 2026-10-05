import { assert, describe, test } from 'vitest'

import { ShellLex, isSpace } from '../src'

describe('ShellLex', () => {
  const lex = new ShellLex('\\')

  test('splits words and strips quotes', () => {
    assert.deepEqual(lex.processWords('KEY="a  b" OTHER=c'), [
      'KEY=a  b',
      'OTHER=c',
    ])
    assert.deepEqual(lex.processWords('a "b c" d\\ e'), ['a', 'b c', 'd e'])
  })

  test('preserves variable references', () => {
    assert.deepEqual(lex.processWords('"$HOME"/x'), ['$HOME/x'])
    assert.deepEqual(lex.processWords("'$HOME'"), ['$HOME'])
    assert.deepEqual(lex.processWords('${V//a/b}'), ['${V//a/b}'])
    assert.deepEqual(lex.processWords('a\\$b'), ['a$b'])
  })

  test('expands variables from env', () => {
    const env = new Map([
      ['V', 'a/b/c'],
      ['E', ''],
    ])
    const lex = new ShellLex('\\', { env })
    assert.equal(lex.processWord('$V-${V}-"$V"'), 'a/b/c-a/b/c-a/b/c')
    assert.equal(lex.processWord('${V:-x}${E:-x}${E-x}${U:-x}'), 'a/b/cx${U:-x}')
    assert.equal(lex.processWord('${V:+y}${E:+y}${E+y}${U+y}'), 'yy${U+y}')
    assert.equal(lex.processWord('${V:?}${U:?msg}'), 'a/b/c${U:?msg}')
    assert.throws(() => lex.processWord('${E:?empty}'), /E: empty/)
    assert.equal(lex.processWord('${V#*/} ${V##*/}'), 'b/c c')
    assert.equal(lex.processWord('${V%/*} ${V%%/*}'), 'a/b a')
    assert.equal(
      lex.processWord('${V/b/x} ${V//\\//-} ${V/?/x}'),
      'a/x/c a-b-c x/b/c'
    )
    assert.equal(lex.processWord('$U ${U} ${U/a/b}'), '$U ${U} ${U/a/b}')
    assert.equal(
      new ShellLex('\\', { env, skipUnsetEnv: false }).processWord(
        '$U-${U:-d}'
      ),
      '-d'
    )
  })

  test('keeps heredoc markers intact', () => {
    assert.deepEqual(lex.processWords('<<EOF cat'), ['<<EOF', 'cat'])
  })

  test('honours the escape token', () => {
    assert.equal(new ShellLex('`').processWord('a`"b'), 'a"b')
  })

  test('raw modes keep quotes and escapes', () => {
    assert.equal(
      new ShellLex('\\', { rawQuotes: true }).processWord('"a b"'),
      '"a b"'
    )
    assert.equal(
      new ShellLex('\\', { rawEscapes: true }).processWord('a\\"b'),
      'a\\"b'
    )
  })

  test('rejects unterminated quotes', () => {
    assert.throws(() => lex.processWord('"unterminated'), /double-quote/)
    assert.throws(() => lex.processWord("x 'y"), /single-quote/)
  })
})

test('isSpace', () => {
  assert.isTrue(isSpace(' '))
  assert.isTrue(isSpace('\u00a0'))
  assert.isFalse(isSpace('a'))
})
