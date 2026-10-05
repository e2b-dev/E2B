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
