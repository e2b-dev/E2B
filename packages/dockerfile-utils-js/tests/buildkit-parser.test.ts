import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assert, describe, test } from 'vitest'

import {
  chompHeredocContent,
  DockerfileHeredoc,
  DockerfileInstruction,
  DockerfileSyntaxError,
  parseDockerfileAst,
  parseHeredoc,
  parseWords,
} from '../src'

// Port of BuildKit's `frontend/dockerfile/parser` tests, see
// `fixtures/buildkit/README.md`.

const FIXTURES = fileURLToPath(
  new URL('./fixtures/buildkit/parser/', import.meta.url)
)

function read(...parts: string[]): string {
  return readFileSync(FIXTURES + parts.join('/'), 'utf-8')
}

const PRINTABLE = /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]$/u

/** `strconv.Quote` */
function goQuote(s: string): string {
  let out = '"'
  for (const ch of s) {
    switch (ch) {
      case '"':
        out += '\\"'
        break
      case '\\':
        out += '\\\\'
        break
      case '\x07':
        out += '\\a'
        break
      case '\b':
        out += '\\b'
        break
      case '\f':
        out += '\\f'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\t':
        out += '\\t'
        break
      case '\v':
        out += '\\v'
        break
      default: {
        if (PRINTABLE.test(ch)) {
          out += ch
          break
        }
        const cp = ch.codePointAt(0) as number
        if (cp < 0x80) {
          out += '\\x' + cp.toString(16).padStart(2, '0')
        } else if (cp < 0x10000) {
          out += '\\u' + cp.toString(16).padStart(4, '0')
        } else {
          out += '\\U' + cp.toString(16).padStart(8, '0')
        }
      }
    }
  }
  return out + '"'
}

/** The flat equivalent of BuildKit's `Node.Dump()` */
function dump(instruction: DockerfileInstruction): string {
  let str = instruction.name.toLowerCase()
  if (instruction.flags.length > 0) {
    str += ` [${instruction.flags.map(goQuote).join(' ')}]`
  }
  if (instruction.name === 'ONBUILD') {
    // BuildKit parses the trigger as a child node
    const rest = instruction.original.replace(/^\S+\s*/, '')
    const [child] = parseDockerfileAst(rest).instructions
    return `(${str} ${dump(child)})`
  }
  for (const arg of instruction.args) {
    str += ' ' + goQuote(arg)
  }
  return `(${str})`
}

function dumpAll(content: string): string {
  return parseDockerfileAst(content).instructions.map(dump).join('\n')
}

describe('BuildKit parser', () => {
  describe('TestParseCases (testfiles)', () => {
    const dirs = readdirSync(FIXTURES + 'testfiles').sort()
    // BuildKit splits shell-form ADD/COPY on whitespace only, this parser
    // honors quotes so `COPY "a b" /dst` works, which changes the result for
    // the unbalanced `ADD \conf\\" /.znc`
    const deviations = new Set(['escapes'])
    test.for(dirs)('%s', (dir, { skip }) => {
      skip(deviations.has(dir), 'ADD/COPY words are quote-aware here')
      const dockerfile = read('testfiles', dir, 'Dockerfile')
      const expected = read('testfiles', dir, 'result')
      assert.strictEqual(dumpAll(dockerfile), expected.trim())
    })
  })

  describe('TestParseErrorCases (testfiles-negative)', () => {
    const dirs = readdirSync(FIXTURES + 'testfiles-negative').sort()
    // BuildKit reports "file with no instructions" for these; an empty
    // instruction list is returned here instead
    const empty = new Set(['empty_dockerfile', 'only_comments'])
    test.each(dirs)('%s', (dir) => {
      const dockerfile = read('testfiles-negative', dir, 'Dockerfile')
      if (empty.has(dir)) {
        assert.deepEqual(parseDockerfileAst(dockerfile).instructions, [])
        return
      }
      assert.throws(() => parseDockerfileAst(dockerfile), DockerfileSyntaxError)
    })
  })

  test('TestParseIncludesLineNumbers', () => {
    const { instructions } = parseDockerfileAst(
      read('testfile-line/Dockerfile')
    )
    assert.lengthOf(instructions, 3)
    const lines = instructions.map((i) => [i.startLine, i.endLine])
    assert.deepEqual(lines, [
      [5, 5],
      [11, 12],
      [17, 31],
    ])
  })

  test('TestParseWarnsOnEmptyContinutationLine', () => {
    const dockerfile = `
FROM alpine:3.6

RUN valid \\
    continuation

RUN something \\

    following \\

    more

RUN another \\

    thing

RUN non-indented \\
# this is a comment
   after-comment

RUN indented \\
    # this is an indented comment
    comment
\t`
    const { warnings } = parseDockerfileAst(dockerfile)
    assert.lengthOf(warnings, 2)
    assert.include(warnings[0].message, 'Empty continuation line found in')
    assert.include(warnings[0].message, 'RUN something     following     more')
    assert.include(warnings[1].message, 'RUN another     thing')
  })

  test('TestParseWords', () => {
    const tests: [string, string[]][] = [
      ['foo', ['foo']],
      ['foo bar', ['foo', 'bar']],
      ['foo\\ bar', ['foo\\ bar']],
      ['foo=bar', ['foo=bar']],
      ["foo bar 'abc xyz'", ['foo', 'bar', "'abc xyz'"]],
      ['foo bar "abc xyz"', ['foo', 'bar', '"abc xyz"']],
      ['àöû', ['àöû']],
      ['föo bàr "âbc xÿz"', ['föo', 'bàr', '"âbc xÿz"']],
    ]
    for (const [input, expected] of tests) {
      assert.deepEqual(parseWords(input, '\\'), expected)
    }
  })

  describe('TestJSONArraysOfStrings', () => {
    const valid: [string, string[]][] = [
      ['[]', []],
      ['[""]', ['']],
      ['["a"]', ['a']],
      ['["a","b"]', ['a', 'b']],
      ['[ "a", "b" ]', ['a', 'b']],
      ['[\t"a",\t"b"\t]', ['a', 'b']],
      ['\t[\t"a",\t"b"\t]\t', ['a', 'b']],
      [
        '["abc 123", "♥", "☃", "\\" \\\\ \\/ \\b \\f \\n \\r \\t \\u0000"]',
        ['abc 123', '♥', '☃', '" \\ / \b \f \n \r \t \u0000'],
      ],
    ]
    const invalid = [
      '["a",42,"b"]',
      '["a",123.456,"b"]',
      '["a",{},"b"]',
      '["a",{"c": "d"},"b"]',
      '["a",["c"],"b"]',
      '["a",true,"b"]',
      '["a",false,"b"]',
      '["a",null,"b"]',
    ]

    test.each(valid)('%j', (json, expected) => {
      const [run] = parseDockerfileAst(`RUN ${json}`).instructions
      assert.isTrue(run.json)
      assert.deepEqual(run.args, expected)
    })

    test.each(invalid)('%j', (json) => {
      assert.throws(
        () => parseDockerfileAst(`RUN ${json}`),
        'Only strings are supported in JSON arrays'
      )
    })
  })

  test('TestParseNameValOldFormat', () => {
    const [label] = parseDockerfileAst('LABEL foo bar').instructions
    assert.deepEqual(label.args, ['foo', 'bar', ''])
  })

  test('TestParseNameValNewFormat', () => {
    const [label] = parseDockerfileAst('LABEL foo=bar thing=star').instructions
    assert.deepEqual(label.args, ['foo', 'bar', '=', 'thing', 'star', '='])
  })

  test('TestParseNameValWithoutVal', () => {
    assert.throws(
      () => parseDockerfileAst('ENV foo'),
      'ENV must have two arguments'
    )
  })

  test('TestParseExtractsHeredoc', () => {
    // The upstream file has an `INVALID` line after `USER <<INVALID`, which
    // this parser rejects as an unknown instruction
    const dockerfile = `
FROM alpine:3.6
ENV NAME=me
RUN ls
USER <<INVALID
RUN <<EMPTY
EMPTY
RUN 3<<EMPTY2
EMPTY2
RUN "<<NOHEREDOC"
RUN <<INDENT
\tfoo
\tbar
INDENT
RUN <<-UNINDENT
\tbaz
\tquux
UNINDENT
RUN <<-UNINDENT2
\tbaz
\tquux
\tUNINDENT2
RUN <<-EXPAND
\texpand $NAME
EXPAND
RUN <<-'NOEXPAND'
\tdon't expand $NAME
NOEXPAND
RUN <<COPY
echo hello world
echo foo bar
COPY
RUN <<COMMENT
# internal comment
echo hello world
echo foo bar # trailing comment
COMMENT
RUN --mount=type=cache,target=/foo <<MOUNT
echo hello
MOUNT
COPY <<FILE1 <<FILE2 /dest
content 1
FILE1
content 2
FILE2
COPY <<EOF /quotes
"foo"
'bar'
EOF
COPY <<X <<Y /dest
Y
X
X
Y
RUN <<COMPLEX python3
print('hello world')
COMPLEX
COPY <<file.txt /dest
hello world
file.txt
RUN <<eo'f'
echo foo
eof
RUN <<eo\\'f
echo foo
eo'f
RUN <<'e'o\\'f
echo foo
eo'f
RUN <<'one two'
echo bar
one two
RUN <<$EOF
$EOF
RUN <<  EOF
EOF
RUN <<  EOF  > foo
EOF
\t`
    const heredoc = (
      name: string,
      content: string,
      options: Partial<DockerfileHeredoc> = {}
    ): DockerfileHeredoc => ({
      name,
      content,
      chomp: false,
      expand: true,
      fileDescriptor: 0,
      ...options,
    })
    const tests: DockerfileHeredoc[][] = [
      [], // ENV EXAMPLE=bla
      [], // RUN ls
      [], // USER <<INVALID
      [heredoc('EMPTY', '')],
      [heredoc('EMPTY2', '', { fileDescriptor: 3 })],
      [], // RUN "<<NOHEREDOC"
      [heredoc('INDENT', '\tfoo\n\tbar\n')],
      [heredoc('UNINDENT', '\tbaz\n\tquux\n', { chomp: true })],
      [heredoc('UNINDENT2', '\tbaz\n\tquux\n', { chomp: true })],
      [heredoc('EXPAND', '\texpand $NAME\n', { chomp: true })],
      [
        heredoc('NOEXPAND', "\tdon't expand $NAME\n", {
          chomp: true,
          expand: false,
        }),
      ],
      [heredoc('COPY', 'echo hello world\necho foo bar\n')],
      [
        heredoc(
          'COMMENT',
          '# internal comment\necho hello world\necho foo bar # trailing comment\n'
        ),
      ],
      [heredoc('MOUNT', 'echo hello\n')],
      [heredoc('FILE1', 'content 1\n'), heredoc('FILE2', 'content 2\n')],
      [heredoc('EOF', '"foo"\n\'bar\'\n')],
      [heredoc('X', 'Y\n'), heredoc('Y', 'X\n')],
      [heredoc('COMPLEX', "print('hello world')\n")],
      [heredoc('file.txt', 'hello world\n')],
      [heredoc('eof', 'echo foo\n', { expand: false })],
      [heredoc("eo'f", 'echo foo\n')],
      [heredoc("eo'f", 'echo foo\n', { expand: false })],
      [heredoc('one two', 'echo bar\n', { expand: false })],
      [heredoc('$EOF', '')],
      [heredoc('EOF', '')],
      [heredoc('EOF', '')],
    ]
    const { instructions } = parseDockerfileAst(dockerfile)
    assert.lengthOf(instructions, tests.length + 1)
    tests.forEach((expected, i) => {
      assert.deepEqual(instructions[i + 1].heredocs, expected)
    })
  })

  test('TestParseJSONHeredoc', () => {
    const dockerfile = `
FROM alpine:3.6
RUN ["whoami"]
RUN ["<<EOF"]
RUN ["<<'EOF'"]
\t`
    const { instructions } = parseDockerfileAst(dockerfile)
    for (let i = 1; i <= 3; i++) {
      assert.deepEqual(instructions[i].heredocs, [])
    }
  })

  test('TestHeredocChomp', () => {
    assert.strictEqual(
      chompHeredocContent('\thello\n\tworld\n'),
      'hello\nworld\n'
    )
  })

  test('TestParseHeredocHelpers', () => {
    const validHeredocs = [
      '<<EOF',
      "<<'EOF'",
      '<<"EOF"',
      '<<-EOF',
      "<<-'EOF'",
      '<<-"EOF"',
      '<<EO"F"',
      '<< EOF',
      '<<- EOF',
    ]
    const invalidHeredocs = ["<<'EOF", '<<"EOF', "<<EOF'", '<<EOF"']
    const notHeredocs = ['', 'EOF', '<<', '<<-', '<EOF', '<<<EOF', '<<EOF sh']

    for (const src of notHeredocs) {
      assert.isUndefined(parseHeredoc(src), src)
    }
    for (const src of validHeredocs) {
      assert.strictEqual(parseHeredoc(src)?.name, 'EOF', src)
    }
    for (const src of invalidHeredocs) {
      assert.throws(() => parseHeredoc(src), undefined, undefined, src)
    }
  })

  test('TestHeredocsFromLine', () => {
    const srcs: [string, string[]][] = [
      ['RUN <<EOF', ['EOF']],
      ['RUN <<-EOF', ['EOF']],
      ['RUN <<EOF', ['EOF']],
      // upstream expects `EOF` here, but only asserts over the heredocs that
      // were found and BuildKit's lexer splits `<<-` and `EOF` into two words
      ['RUN <<- EOF', []],
      ['RUN << -EOF', ['-EOF']],
      ["RUN <<'EOF'", ['EOF']],
      ['RUN 4<<EOF', ['EOF']],
      ['RUN <<EOF <<EOF2', ['EOF', 'EOF2']],
      ["RUN '<<EOF'", []],
      ['RUN "<<EOF"', []],
    ]
    for (const [line, names] of srcs) {
      const dockerfile = [line, ...names, ''].join('\n')
      const [run] = parseDockerfileAst(dockerfile).instructions
      assert.deepEqual(
        run.heredocs.map((h) => h.name),
        names,
        line
      )
    }
  })

  describe('directives', () => {
    test('TestParser (escape directive)', () => {
      const { escapeToken } = parseDockerfileAst(
        '#escape=\\\n# key = FOO bar\nFROM x'
      )
      assert.strictEqual(escapeToken, '\\')
    })

    test('TestParserEscapeCaseInsensitive', () => {
      const { escapeToken } = parseDockerfileAst('# EScape=`\nFROM x')
      assert.strictEqual(escapeToken, '`')
    })
  })
})
