import { buildTemplateTest } from '../../setup'
import { DockerfileSyntaxError, Template } from '../../../src'
import { InstructionType } from '../../../src/template/types'
import { assert } from 'vitest'

buildTemplateTest('fromDockerfile', async () => {
  const dockerfile = `FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install
ENTRYPOINT ["sleep", "20"]`

  const template = Template().fromDockerfile(dockerfile)

  assert.equal(
    // @ts-expect-error - baseImage is not a property of TemplateBuilder
    template.baseImage,
    'node:24'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[1].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[1].args[0],
    '/'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[2].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[2].args[0],
    '/app'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[3].type,
    InstructionType.COPY
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[3].args[0],
    'package.json'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[3].args[1],
    '.'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[4].type,
    InstructionType.RUN
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[4].args[0],
    'npm install'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[5].type,
    InstructionType.USER
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[5].args[0],
    'user'
  )
  assert.equal(
    // @ts-expect-error - startCmd is not a property of TemplateBuilder
    template.startCmd,
    'sleep 20'
  )
})

buildTemplateTest('fromDockerfile with default user and workdir', () => {
  const dockerfile = 'FROM node:24'
  const template = Template().fromDockerfile(dockerfile)

  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].type,
    InstructionType.USER
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].args[0],
    'user'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].args[0],
    '/home/user'
  )
})

buildTemplateTest('fromDockerfile with custom user and workdir', () => {
  const dockerfile = 'FROM node:24\nUSER mish\nWORKDIR /home/mish'
  const template = Template().fromDockerfile(dockerfile)

  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].type,
    InstructionType.USER
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].args[0],
    'mish'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].args[0],
    '/home/mish'
  )
})

buildTemplateTest('fromDockerfile with multi-source COPY', () => {
  const dockerfile = `FROM node:24
COPY file1.txt file2.txt file3.txt /dest/`

  const template = Template().fromDockerfile(dockerfile)

  // After initial USER root and WORKDIR /, the multi-source COPY should
  // expand into one COPY instruction per source.
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstructions = template.instructions.filter(
    (i: { type: InstructionType }) => i.type === InstructionType.COPY
  )

  assert.equal(copyInstructions.length, 3)
  assert.equal(copyInstructions[0].args[0], 'file1.txt')
  assert.equal(copyInstructions[0].args[1], '/dest/')
  assert.equal(copyInstructions[1].args[0], 'file2.txt')
  assert.equal(copyInstructions[1].args[1], '/dest/')
  assert.equal(copyInstructions[2].args[0], 'file3.txt')
  assert.equal(copyInstructions[2].args[1], '/dest/')
})

buildTemplateTest('fromDockerfile with multi-source COPY --chown', () => {
  const dockerfile = `FROM node:24
COPY --chown=myuser:mygroup pkg.json pkg-lock.json /app/`

  const template = Template().fromDockerfile(dockerfile)

  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstructions = template.instructions.filter(
    (i: { type: InstructionType }) => i.type === InstructionType.COPY
  )

  assert.equal(copyInstructions.length, 2)
  assert.equal(copyInstructions[0].args[0], 'pkg.json')
  assert.equal(copyInstructions[0].args[1], '/app/')
  assert.equal(copyInstructions[0].args[2], 'myuser:mygroup')
  assert.equal(copyInstructions[1].args[0], 'pkg-lock.json')
  assert.equal(copyInstructions[1].args[1], '/app/')
  assert.equal(copyInstructions[1].args[2], 'myuser:mygroup')
})

buildTemplateTest('fromDockerfile with COPY --chown', () => {
  const dockerfile = `FROM node:24
COPY --chown=myuser:mygroup app.js /app/
COPY --chown=anotheruser config.json /config/`

  const template = Template().fromDockerfile(dockerfile)

  // First COPY instruction (after initial USER root and WORKDIR /)
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstruction1 = template.instructions[2]
  assert.equal(copyInstruction1.type, InstructionType.COPY)
  assert.equal(copyInstruction1.args[0], 'app.js')
  assert.equal(copyInstruction1.args[1], '/app/')
  assert.equal(copyInstruction1.args[2], 'myuser:mygroup') // user from --chown

  // Second COPY instruction
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstruction2 = template.instructions[3]
  assert.equal(copyInstruction2.type, InstructionType.COPY)
  assert.equal(copyInstruction2.args[0], 'config.json')
  assert.equal(copyInstruction2.args[1], '/config/')
  assert.equal(copyInstruction2.args[2], 'anotheruser') // user from --chown (without group)
})

function instructionsOf(template: unknown) {
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  return template.instructions as { type: InstructionType; args: string[] }[]
}

buildTemplateTest('fromDockerfile with quoted ENV and ARG values', () => {
  const dockerfile = `FROM node:24
ENV A="hello world" B='single quoted' C=plain D=escaped\\ space
ENV LEGACY some value with  spaces
ENV MULTI=1 \\
    # comment inside continuation
    LINE="two \\
words"
ARG VERSION=1.0 NAME="with space" EMPTY
ENV REF="$HOME/bin:\${PATH}"`

  const template = Template().fromDockerfile(dockerfile)
  const envs = instructionsOf(template)
    .filter((i) => i.type === InstructionType.ENV)
    .map((i) => i.args)

  assert.deepEqual(envs, [
    [
      'A',
      'hello world',
      'B',
      'single quoted',
      'C',
      'plain',
      'D',
      'escaped space',
    ],
    ['LEGACY', 'some value with  spaces'],
    ['MULTI', '1', 'LINE', 'two words'],
    ['VERSION', '1.0', 'NAME', 'with space', 'EMPTY', ''],
    ['REF', '$HOME/bin:${PATH}'],
  ])
})

buildTemplateTest(
  'fromDockerfile with mixed-case keywords and AS alias',
  () => {
    const dockerfile = `from node:24 As Builder
run echo hi
Workdir /app
uSeR node`

    const template = Template().fromDockerfile(dockerfile)
    // @ts-expect-error - baseImage is not a property of TemplateBuilder
    assert.equal(template.baseImage, 'node:24')
    const instructions = instructionsOf(template)
    assert.equal(instructions[2].type, InstructionType.RUN)
    assert.deepEqual(instructions[2].args, ['echo hi'])
    assert.deepEqual(instructions[3].args, ['/app'])
    assert.deepEqual(instructions[4].args, ['node'])
  }
)

buildTemplateTest(
  'fromDockerfile preserves whitespace in RUN and uses shell form',
  () => {
    const dockerfile = `FROM node:24
RUN echo "a   b"   &&   \\
    echo 'c   d'
RUN ["echo", "hello world", "it's"]`

    const template = Template().fromDockerfile(dockerfile)
    const runs = instructionsOf(template)
      .filter((i) => i.type === InstructionType.RUN)
      .map((i) => i.args[0])

    assert.deepEqual(runs, [
      `echo "a   b"   &&       echo 'c   d'`,
      `echo 'hello world' 'it'"'"'s'`,
    ])
  }
)

buildTemplateTest('fromDockerfile with escape directive', () => {
  const dockerfile = `# escape=\`
FROM node:24
RUN echo one \`
    && echo two
ENV P="C:\\tools"`

  const template = Template().fromDockerfile(dockerfile)
  const instructions = instructionsOf(template)
  assert.deepEqual(instructions[2].args, ['echo one     && echo two'])
  assert.deepEqual(instructions[3].args, ['P', 'C:\\tools'])
})

buildTemplateTest('fromDockerfile with COPY --chmod and quoted paths', () => {
  const dockerfile = `FROM node:24
COPY --chmod=755 --chown=app:app "my file.txt" other.txt /dest/
COPY ["json file.txt", "/dest/"]
ADD archive.tar.gz /opt/`

  const template = Template().fromDockerfile(dockerfile)
  const copies = instructionsOf(template)
    .filter((i) => i.type === InstructionType.COPY)
    .map((i) => i.args)

  assert.deepEqual(copies, [
    ['my file.txt', '/dest/', 'app:app', '0755'],
    ['other.txt', '/dest/', 'app:app', '0755'],
    ['json file.txt', '/dest/', '', ''],
    ['archive.tar.gz', '/opt/', '', ''],
  ])
})

buildTemplateTest('fromDockerfile with heredocs', () => {
  const dockerfile = `FROM node:24
RUN <<EOF
npm install
npm run build
EOF
RUN <<-EOT
\techo tabbed
EOT
RUN python3 - <<PY
print("hi")
PY
RUN 3<<FD
touch /tmp/fd
FD
COPY <<'CONF' /etc/app.conf
key=$VALUE
CONF`

  const template = Template().fromDockerfile(dockerfile)
  const runs = instructionsOf(template)
    .filter((i) => i.type === InstructionType.RUN)
    .map((i) => i.args[0])

  assert.deepEqual(runs, [
    'npm install\nnpm run build\n',
    'echo tabbed\n',
    'python3 - <<PY\nprint("hi")\nPY',
    'touch /tmp/fd\n',
    `E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/CONF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<'E2B_HEREDOC_CONF' >"$E2B_HEREDOC_DEST"\nkey=$VALUE\nE2B_HEREDOC_CONF`,
  ])
})

buildTemplateTest('fromDockerfile COPY heredoc runs as root', () => {
  const dockerfile = `FROM node:24
USER app
COPY <<EOF /etc/app.conf
E2B_HEREDOC_EOF
x=1
EOF`

  const template = Template().fromDockerfile(dockerfile)
  const runs = instructionsOf(template)
    .filter((i) => i.type === InstructionType.RUN)
    .map((i) => i.args)

  assert.deepEqual(runs, [
    [
      `E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF_ >"$E2B_HEREDOC_DEST"\nE2B_HEREDOC_EOF\nx=1\nE2B_HEREDOC_EOF_`,
      'root',
    ],
  ])
})

buildTemplateTest(
  'fromDockerfile heredoc terminator avoids the content',
  () => {
    const dockerfile = `FROM node:24
COPY <<EOF /etc/app.conf
E2B_HEREDOC_EOF___ E2B_HEREDOC_EOF_
E2B_HEREDOC_EOF
EOF`

    const template = Template().fromDockerfile(dockerfile)
    const runs = instructionsOf(template)
      .filter((i) => i.type === InstructionType.RUN)
      .map((i) => i.args[0])

    assert.deepEqual(runs, [
      `E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF____ >"$E2B_HEREDOC_DEST"\nE2B_HEREDOC_EOF___ E2B_HEREDOC_EOF_\nE2B_HEREDOC_EOF\nE2B_HEREDOC_EOF____`,
    ])
  }
)

buildTemplateTest(
  'fromDockerfile COPY heredoc into a directory expands only variables',
  () => {
    const dockerfile = `FROM node:24
COPY <<EOF /etc/
run \`npm start\` and $(id) for $USER, \\$(literal) and \${HOME:-$(x)}
EOF
COPY <<EOF .
x
EOF`

    const template = Template().fromDockerfile(dockerfile)
    const runs = instructionsOf(template)
      .filter((i) => i.type === InstructionType.RUN)
      .map((i) => i.args[0])

    assert.deepEqual(runs, [
      'E2B_HEREDOC_DEST=/etc/EOF\n' +
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n' +
        'run \\`npm start\\` and \\$(id) for $USER, \\$(literal) and ${HOME:-\\$(x)}\nE2B_HEREDOC_EOF',
      'E2B_HEREDOC_DEST=.\n' +
        'if [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\n' +
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n' +
        'x\nE2B_HEREDOC_EOF',
    ])
  }
)

buildTemplateTest(
  'fromDockerfile COPY heredoc keeps Docker substitution patterns',
  () => {
    const dockerfile = `FROM node:24
COPY <<EOF /etc/app.conf
\${X/old/new} \${X//o/0} \${X/a\\/b/c} \${X/\`/x} \${Y#\\*} \${Y%%\\}} \${Z:-foo\\}bar} \${Z:-a\\\\b}
EOF`

    const template = Template().fromDockerfile(dockerfile)
    const runs = instructionsOf(template)
      .filter((i) => i.type === InstructionType.RUN)
      .map((i) => i.args[0])

    assert.deepEqual(runs, [
      'E2B_HEREDOC_DEST=/etc/app.conf\n' +
        'if [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\n' +
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n' +
        '${X/old/new} ${X//o/0} ${X/a\\/b/c} ${X/\\`/x} ${Y#\\*} ${Y%%\\}} ${Z:-foo\\}bar} ${Z:-a\\\\b}\nE2B_HEREDOC_EOF',
    ])
  }
)

buildTemplateTest(
  'fromDockerfile COPY --chmod resolves ARG and ENV values',
  () => {
    const dockerfile = `FROM node:24
ARG MODE=440
ENV FULL=0\${MODE}
COPY --chmod=$MODE a /a
COPY --chmod=\${FULL} b /b
COPY --chmod=\${UNSET:-755} c /c`

    const template = Template().fromDockerfile(dockerfile)
    const copies = instructionsOf(template)
      .filter((i) => i.type === InstructionType.COPY)
      .map((i) => i.args)

    assert.deepEqual(copies, [
      ['a', '/a', '', '0440'],
      ['b', '/b', '', '0440'],
      ['c', '/c', '', '0755'],
    ])
  }
)

buildTemplateTest(
  'fromDockerfile COPY heredoc with a shell-unsafe name',
  () => {
    const dockerfile = `FROM node:24
COPY <<FOO;BAR /etc/
hi
FOO;BAR`

    const template = Template().fromDockerfile(dockerfile)
    const runs = instructionsOf(template)
      .filter((i) => i.type === InstructionType.RUN)
      .map((i) => i.args[0])

    assert.deepEqual(runs, [
      "E2B_HEREDOC_DEST='/etc/FOO;BAR'\n" +
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_FOO_BAR >"$E2B_HEREDOC_DEST"\n' +
        'hi\nE2B_HEREDOC_FOO_BAR',
    ])
  }
)

buildTemplateTest(
  'fromDockerfile COPY with literal paths and zero mode',
  () => {
    const dockerfile = `FROM node:24
COPY "<<EOF" /tmp/
COPY --chmod=000 secret.txt /tmp/`

    const template = Template().fromDockerfile(dockerfile)
    const copies = instructionsOf(template)
      .filter((i) => i.type === InstructionType.COPY)
      .map((i) => i.args)

    assert.deepEqual(copies, [
      ['<<EOF', '/tmp/', '', ''],
      ['secret.txt', '/tmp/', '', '0000'],
    ])
  }
)

buildTemplateTest('fromDockerfile combines ENTRYPOINT and CMD', () => {
  const cases: [string, string | undefined][] = [
    [
      'ENTRYPOINT ["npm", "run"]\nCMD ["start", "--port 80"]',
      `npm run start '--port 80'`,
    ],
    ['ENTRYPOINT ["npm"]\nCMD run start', `npm /bin/sh -c 'run start'`],
    ['ENTRYPOINT npm start\nCMD ["ignored"]', 'npm start'],
    ['CMD npm start', 'npm start'],
    ['CMD ["npm", "start"]', 'npm start'],
    ['', undefined],
    ['CMD', undefined],
    ['ENTRYPOINT', undefined],
  ]
  for (const [tail, expected] of cases) {
    const template = Template().fromDockerfile(`FROM node:24\n${tail}`)
    // @ts-expect-error - startCmd is not a property of TemplateBuilder
    assert.equal(template.startCmd, expected, tail)
  }
})

buildTemplateTest(
  'fromDockerfile ignores metadata instructions and flags',
  () => {
    const dockerfile = `FROM --platform=linux/amd64 node:24
EXPOSE 80 443
VOLUME ["/data"]
LABEL maintainer="me"
STOPSIGNAL SIGTERM
HEALTHCHECK NONE
RUN --mount=type=cache,target=/root/.npm npm ci`

    const template = Template().fromDockerfile(dockerfile)
    const instructions = instructionsOf(template)
    assert.equal(instructions[2].type, InstructionType.RUN)
    assert.deepEqual(instructions[2].args, ['npm ci'])
  }
)

buildTemplateTest('fromDockerfile rejects invalid Dockerfiles', () => {
  const cases: [string, RegExp][] = [
    ['', /must contain a FROM/],
    ['RUN echo hi', /must contain a FROM/],
    ['FROM a\nFROM b', /Multi-stage/],
    ['FROM a\nRUN <<EOF\nnever closed', /unterminated heredoc/],
    ['FROM a\nCOPY <<EOF /x\n${}\nEOF', /bad substitution/],
    ['FROM a\nCOPY <<EOF /x\n${HOME:-\nEOF', /missing '}'/],
    ['FROM a\nCOPY <<EOF /x\n${X/a\nEOF', /missing '\/' in \${}/],
    ['FROM a\nCOPY <<EOF /x\n${X:/a/b}\nEOF', /unsupported modifier \(:\/\)/],
    [
      'FROM a\nCOPY --chmod=$NOPE a b',
      /invalid chmod value "\$NOPE" \(resolves to ""\)/,
    ],
    ['FROM a\nBOGUS instruction', /unknown instruction: BOGUS/],
    ['FROM a\nCOPY --unknown=1 a b', /unknown flag: unknown/],
    ['FROM a\nCOPY --from=builder a b', /--from is not supported/],
    ['FROM a\nCOPY --toString=1 a b', /unknown flag: toString/],
    ['FROM a\nENV K="unterminated', /looking for matching double-quote/],
    ['FROM a\nRUN ["not", 1]', /Only strings are supported/],
  ]
  for (const [dockerfile, expected] of cases) {
    assert.throws(
      () => Template().fromDockerfile(dockerfile),
      DockerfileSyntaxError,
      expected,
      dockerfile
    )
  }
})
