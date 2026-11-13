import { assert, describe, test } from 'vitest'

import {
  DockerfileSyntaxError,
  chompHeredocContent,
  parseDockerfileAst,
  parseHeredoc,
  parseWords,
} from '../src'

describe('parseDockerfileAst', () => {
  test('upper-cases instruction names and keeps argument casing', () => {
    const ast = parseDockerfileAst('from node:24 as build\n')
    assert.equal(ast.escapeToken, '\\')
    assert.lengthOf(ast.instructions, 1)
    assert.equal(ast.instructions[0].name, 'FROM')
    assert.deepEqual(ast.instructions[0].args, ['node:24', 'as', 'build'])
    assert.isFalse(ast.instructions[0].json)
  })

  test('honours the escape directive', () => {
    const ast = parseDockerfileAst('# escape=`\nFROM a\nRUN echo a `\n  b\n')
    assert.equal(ast.escapeToken, '`')
    const run = ast.instructions[1]
    assert.deepEqual(run.args, ['echo a   b'])
    assert.equal(run.startLine, 3)
    assert.equal(run.endLine, 4)
  })

  test('drops comments inside continuations', () => {
    const ast = parseDockerfileAst(
      'FROM a\nRUN apt-get update \\\n  # comment\n  && apt-get install -y curl\n'
    )
    assert.deepEqual(ast.instructions[1].args, [
      'apt-get update   && apt-get install -y curl',
    ])
  })

  test('parses JSON form', () => {
    const ast = parseDockerfileAst('FROM a\nCMD ["a", "b c"]\n')
    assert.isTrue(ast.instructions[1].json)
    assert.deepEqual(ast.instructions[1].args, ['a', 'b c'])
  })

  test('separates builder flags from arguments', () => {
    const ast = parseDockerfileAst(
      'FROM a\nCOPY --chown=1:1 --chmod=755 a b /d\n'
    )
    assert.deepEqual(ast.instructions[1].flags, ['--chown=1:1', '--chmod=755'])
    assert.deepEqual(ast.instructions[1].args, ['a', 'b', '/d'])
  })

  test('parses ENV key/value and legacy forms into triples', () => {
    const ast = parseDockerfileAst(
      'FROM a\nENV A=1 B="x y"\nENV LEGACY some value\n'
    )
    assert.deepEqual(ast.instructions[1].args, [
      'A',
      '1',
      '=',
      'B',
      '"x y"',
      '=',
    ])
    assert.deepEqual(ast.instructions[2].args, ['LEGACY', 'some value', ''])
  })

  test('collects heredocs', () => {
    const ast = parseDockerfileAst(
      "FROM a\nRUN <<EOF\necho hi\nEOF\nRUN <<-'EOT' cat\n\thi\nEOT\n"
    )
    const [, first, second] = ast.instructions
    assert.deepEqual(first.args, ['<<EOF'])
    assert.deepEqual(first.heredocs, [
      {
        name: 'EOF',
        content: 'echo hi\n',
        chomp: false,
        expand: true,
        fileDescriptor: 0,
      },
    ])
    assert.equal(first.endLine, 4)
    assert.deepEqual(second.heredocs, [
      {
        name: 'EOT',
        content: '\thi\n',
        chomp: true,
        expand: false,
        fileDescriptor: 0,
      },
    ])
  })

  test('strips a BOM', () => {
    const ast = parseDockerfileAst('\ufeffFROM a\n')
    assert.equal(ast.instructions[0].name, 'FROM')
  })

  test('warns about empty continuation lines', () => {
    const ast = parseDockerfileAst('FROM a\nRUN a \\\n\nb\n')
    assert.deepEqual(ast.instructions[1].args, ['a b'])
    assert.lengthOf(ast.warnings, 1)
    assert.match(ast.warnings[0].message, /Empty continuation line/)
  })

  test('tolerates a trailing continuation at EOF', () => {
    const ast = parseDockerfileAst('FROM a\nRUN echo \\\n')
    assert.deepEqual(ast.instructions[1].args, ['echo'])
  })

  test('accepts empty and comment-only input', () => {
    assert.lengthOf(parseDockerfileAst('').instructions, 0)
    assert.lengthOf(parseDockerfileAst('# only comment\n').instructions, 0)
  })

  test('rejects unknown instructions with a line number', () => {
    assert.throws(
      () => parseDockerfileAst('FROM a\nRNU x\n'),
      DockerfileSyntaxError,
      /line 2: unknown instruction: RNU/
    )
  })
})

test('parseHeredoc', () => {
  assert.equal(parseHeredoc('<<' + ' '.repeat(50_000) + '<'), undefined)
  assert.equal(parseHeredoc('\u00b2<<EOF'), undefined)
  assert.equal(parseHeredoc('<<' + ' '.repeat(50_000)), undefined)
  assert.deepEqual(parseHeredoc('<<-EOF'), {
    name: 'EOF',
    content: '',
    chomp: true,
    expand: true,
    fileDescriptor: 0,
  })
  assert.deepEqual(parseHeredoc("<<'EOF'"), {
    name: 'EOF',
    content: '',
    chomp: false,
    expand: false,
    fileDescriptor: 0,
  })
  assert.equal(parseHeredoc('3<<EOF')?.fileDescriptor, 3)
  assert.isUndefined(parseHeredoc('<<'))
  assert.isUndefined(parseHeredoc('abc'))
})

test('chompHeredocContent strips leading tabs', () => {
  assert.equal(chompHeredocContent('\thi\n\t\tthere\n'), 'hi\nthere\n')
})

test('parseWords keeps quotes and escapes', () => {
  assert.deepEqual(parseWords('a "b c" d\\ e', '\\'), ['a', '"b c"', 'd\\ e'])
})
