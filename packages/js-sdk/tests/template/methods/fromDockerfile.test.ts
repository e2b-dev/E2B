import { assert, test } from 'vitest'
import { DockerfileSyntaxError, Template, TemplateClass } from '../../../src'

type Step = { type: string; args: string[] }

async function serialized(template: TemplateClass) {
  return JSON.parse(await Template.toJSON(template, false)) as {
    fromImage?: string
    startCmd?: string
    steps: Step[]
  }
}

async function stepsOf(dockerfile: string): Promise<Step[]> {
  const { steps } = await serialized(Template().fromDockerfile(dockerfile))
  return steps.map(({ type, args }) => ({ type, args }))
}

async function argsOf(dockerfile: string, type: string): Promise<string[][]> {
  return (await stepsOf(dockerfile))
    .filter((step) => step.type === type)
    .map((step) => step.args)
}

test('fromDockerfile', async () => {
  const dockerfile = `FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install
ENTRYPOINT ["sleep", "20"]`

  const { fromImage, startCmd, steps } = await serialized(
    Template().fromDockerfile(dockerfile)
  )

  assert.equal(fromImage, 'node:24')
  assert.deepEqual(
    steps.slice(1, 6).map(({ type, args }) => ({ type, args })),
    [
      { type: 'WORKDIR', args: ['/'] },
      { type: 'WORKDIR', args: ['/app'] },
      { type: 'COPY', args: ['package.json', '.', '', ''] },
      { type: 'RUN', args: ['npm install'] },
      { type: 'USER', args: ['user'] },
    ]
  )
  assert.equal(startCmd, 'sleep 20')
})

test('fromDockerfile with default user and workdir', async () => {
  const dockerfile = 'FROM node:24'
  const steps = await stepsOf(dockerfile)

  assert.deepEqual(steps.slice(-2), [
    { type: 'USER', args: ['user'] },
    { type: 'WORKDIR', args: ['/home/user'] },
  ])
})

test('fromDockerfile with custom user and workdir', async () => {
  const dockerfile = 'FROM node:24\nUSER mish\nWORKDIR /home/mish'
  const steps = await stepsOf(dockerfile)

  assert.deepEqual(steps.slice(-2), [
    { type: 'USER', args: ['mish'] },
    { type: 'WORKDIR', args: ['/home/mish'] },
  ])
})

test('fromDockerfile with multi-source COPY', async () => {
  const dockerfile = `FROM node:24
COPY file1.txt file2.txt file3.txt /dest/`

  // After initial USER root and WORKDIR /, the multi-source COPY should
  // expand into one COPY instruction per source.
  const copyInstructions = await argsOf(dockerfile, 'COPY')

  assert.equal(copyInstructions.length, 3)
  assert.equal(copyInstructions[0][0], 'file1.txt')
  assert.equal(copyInstructions[0][1], '/dest/')
  assert.equal(copyInstructions[1][0], 'file2.txt')
  assert.equal(copyInstructions[1][1], '/dest/')
  assert.equal(copyInstructions[2][0], 'file3.txt')
  assert.equal(copyInstructions[2][1], '/dest/')
})

test('fromDockerfile with multi-source COPY --chown', async () => {
  const dockerfile = `FROM node:24
COPY --chown=myuser:mygroup pkg.json pkg-lock.json /app/`

  const copyInstructions = await argsOf(dockerfile, 'COPY')

  assert.equal(copyInstructions.length, 2)
  assert.equal(copyInstructions[0][0], 'pkg.json')
  assert.equal(copyInstructions[0][1], '/app/')
  assert.equal(copyInstructions[0][2], 'myuser:mygroup')
  assert.equal(copyInstructions[1][0], 'pkg-lock.json')
  assert.equal(copyInstructions[1][1], '/app/')
  assert.equal(copyInstructions[1][2], 'myuser:mygroup')
})

test('fromDockerfile with COPY --chown', async () => {
  const dockerfile = `FROM node:24
COPY --chown=myuser:mygroup app.js /app/
COPY --chown=anotheruser config.json /config/`

  const instructions = await stepsOf(dockerfile)

  // First COPY instruction (after initial USER root and WORKDIR /)
  const copyInstruction1 = instructions[2]
  assert.equal(copyInstruction1.type, 'COPY')
  assert.equal(copyInstruction1.args[0], 'app.js')
  assert.equal(copyInstruction1.args[1], '/app/')
  assert.equal(copyInstruction1.args[2], 'myuser:mygroup') // user from --chown

  // Second COPY instruction
  const copyInstruction2 = instructions[3]
  assert.equal(copyInstruction2.type, 'COPY')
  assert.equal(copyInstruction2.args[0], 'config.json')
  assert.equal(copyInstruction2.args[1], '/config/')
  assert.equal(copyInstruction2.args[2], 'anotheruser') // user from --chown (without group)
})

test('fromDockerfile with quoted ENV and ARG values', async () => {
  const dockerfile = `FROM node:24
ENV A="hello world" B='single quoted' C=plain D=escaped\\ space
ENV LEGACY some value with  spaces
ENV MULTI=1 \\
    # comment inside continuation
    LINE="two \\
words"
ARG VERSION=1.0 NAME="with space" EMPTY
ENV REF="$HOME/bin:\${PATH}"`

  const envs = await argsOf(dockerfile, 'ENV')

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

test('fromDockerfile with mixed-case keywords and AS alias', async () => {
  const dockerfile = `from node:24 As Builder
run echo hi
Workdir /app
uSeR node`

  const { fromImage } = await serialized(Template().fromDockerfile(dockerfile))
  assert.equal(fromImage, 'node:24')
  const instructions = await stepsOf(dockerfile)
  assert.equal(instructions[2].type, 'RUN')
  assert.deepEqual(instructions[2].args, ['echo hi'])
  assert.deepEqual(instructions[3].args, ['/app'])
  assert.deepEqual(instructions[4].args, ['node'])
})

test('fromDockerfile preserves whitespace in RUN and uses shell form', async () => {
  const dockerfile = `FROM node:24
RUN echo "a   b"   &&   \\
    echo 'c   d'
RUN ["echo", "hello world", "it's"]`

  const runs = (await argsOf(dockerfile, 'RUN')).map((args) => args[0])

  assert.deepEqual(runs, [
    `echo "a   b"   &&       echo 'c   d'`,
    `echo 'hello world' 'it'"'"'s'`,
  ])
})

test('fromDockerfile with escape directive', async () => {
  const dockerfile = `# escape=\`
FROM node:24
RUN echo one \`
    && echo two
ENV P="C:\\tools"`

  const instructions = await stepsOf(dockerfile)
  assert.deepEqual(instructions[2].args, ['echo one     && echo two'])
  assert.deepEqual(instructions[3].args, ['P', 'C:\\tools'])
})

test('fromDockerfile with COPY --chmod and quoted paths', async () => {
  const dockerfile = `FROM node:24
COPY --chmod=755 --chown=app:app "my file.txt" other.txt /dest/
COPY ["json file.txt", "/dest/"]
ADD archive.tar.gz /opt/`

  const copies = await argsOf(dockerfile, 'COPY')

  assert.deepEqual(copies, [
    ['my file.txt', '/dest/', 'app:app', '0755'],
    ['other.txt', '/dest/', 'app:app', '0755'],
    ['json file.txt', '/dest/', '', ''],
    ['archive.tar.gz', '/opt/', '', ''],
  ])
})

test('fromDockerfile with heredocs', async () => {
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

  const runs = (await argsOf(dockerfile, 'RUN')).map((args) => args[0])

  assert.deepEqual(runs, [
    'npm install\nnpm run build\n',
    'echo tabbed\n',
    'python3 - <<PY\nprint("hi")\nPY',
    'touch /tmp/fd\n',
    `E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/CONF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<'E2B_HEREDOC_CONF' >"$E2B_HEREDOC_DEST"\nkey=$VALUE\nE2B_HEREDOC_CONF`,
  ])
})

test('fromDockerfile COPY heredoc runs as root', async () => {
  const dockerfile = `FROM node:24
USER app
COPY <<EOF /etc/app.conf
E2B_HEREDOC_EOF
x=1
EOF`

  const runs = await argsOf(dockerfile, 'RUN')

  assert.deepEqual(runs, [
    [
      `E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF_ >"$E2B_HEREDOC_DEST"\nE2B_HEREDOC_EOF\nx=1\nE2B_HEREDOC_EOF_`,
      'root',
    ],
  ])
})

test('fromDockerfile heredoc terminator avoids the content', async () => {
  const dockerfile = `FROM node:24
COPY <<EOF /etc/app.conf
E2B_HEREDOC_EOF___ E2B_HEREDOC_EOF_
E2B_HEREDOC_EOF
EOF`

  const runs = (await argsOf(dockerfile, 'RUN')).map((args) => args[0])

  assert.deepEqual(runs, [
    `E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF____ >"$E2B_HEREDOC_DEST"\nE2B_HEREDOC_EOF___ E2B_HEREDOC_EOF_\nE2B_HEREDOC_EOF\nE2B_HEREDOC_EOF____`,
  ])
})

test('fromDockerfile COPY heredoc into a directory expands only variables', async () => {
  const dockerfile = `FROM node:24
COPY <<EOF /etc/
run \`npm start\` and $(id) for $USER, \\$(literal) and \${HOME:-$(x)}
EOF
COPY <<EOF .
x
EOF`

  const runs = (await argsOf(dockerfile, 'RUN')).map((args) => args[0])

  assert.deepEqual(runs, [
    'E2B_HEREDOC_DEST=/etc/EOF\n' +
      'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n' +
      'run \\`npm start\\` and \\$(id) for $USER, \\$(literal) and ${HOME:-\\$(x)}\nE2B_HEREDOC_EOF',
    'E2B_HEREDOC_DEST=.\n' +
      'if [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\n' +
      'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n' +
      'x\nE2B_HEREDOC_EOF',
  ])
})

test('fromDockerfile COPY heredoc keeps Docker substitution patterns', async () => {
  const dockerfile = `FROM node:24
COPY <<EOF /etc/app.conf
\${X/old/new} \${X//o/0} \${X/a\\/b/c} \${X/\`/x} \${Y#\\*} \${Y%%\\}} \${Z:-foo\\}bar} \${Z:-a\\\\b}
EOF`

  const runs = (await argsOf(dockerfile, 'RUN')).map((args) => args[0])

  assert.deepEqual(runs, [
    'E2B_HEREDOC_DEST=/etc/app.conf\n' +
      'if [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\n' +
      'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n' +
      '${X/old/new} ${X//o/0} ${X/a\\/b/c} ${X/\\`/x} ${Y#\\*} ${Y%%\\}} ${Z:-foo\\}bar} ${Z:-a\\\\b}\nE2B_HEREDOC_EOF',
  ])
})

test('fromDockerfile COPY --chmod resolves ARG and ENV values', async () => {
  const dockerfile = `FROM node:24
ARG MODE=440
ENV FULL=0\${MODE}
COPY --chmod=$MODE a /a
COPY --chmod=\${FULL} b /b
COPY --chmod=\${UNSET:-755} c /c`

  const copies = await argsOf(dockerfile, 'COPY')

  assert.deepEqual(copies, [
    ['a', '/a', '', '0440'],
    ['b', '/b', '', '0440'],
    ['c', '/c', '', '0755'],
  ])
})

test('fromDockerfile COPY heredoc with a shell-unsafe name', async () => {
  const dockerfile = `FROM node:24
COPY <<FOO;BAR /etc/
hi
FOO;BAR`

  const runs = (await argsOf(dockerfile, 'RUN')).map((args) => args[0])

  assert.deepEqual(runs, [
    "E2B_HEREDOC_DEST='/etc/FOO;BAR'\n" +
      'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_FOO_BAR >"$E2B_HEREDOC_DEST"\n' +
      'hi\nE2B_HEREDOC_FOO_BAR',
  ])
})

test('fromDockerfile COPY with literal paths and zero mode', async () => {
  const dockerfile = `FROM node:24
COPY "<<EOF" /tmp/
COPY --chmod=000 secret.txt /tmp/`

  const copies = await argsOf(dockerfile, 'COPY')

  assert.deepEqual(copies, [
    ['<<EOF', '/tmp/', '', ''],
    ['secret.txt', '/tmp/', '', '0000'],
  ])
})

test('fromDockerfile combines ENTRYPOINT and CMD', async () => {
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
    const { startCmd } = await serialized(
      Template().fromDockerfile(`FROM node:24\n${tail}`)
    )
    assert.equal(startCmd, expected, tail)
  }
})

test('fromDockerfile ignores metadata instructions and flags', async () => {
  const dockerfile = `FROM --platform=linux/amd64 node:24
EXPOSE 80 443
VOLUME ["/data"]
LABEL maintainer="me"
STOPSIGNAL SIGTERM
HEALTHCHECK NONE
RUN --mount=type=cache,target=/root/.npm npm ci`

  const instructions = await stepsOf(dockerfile)
  assert.equal(instructions[2].type, 'RUN')
  assert.deepEqual(instructions[2].args, ['npm ci'])
})

test('fromDockerfile rejects invalid Dockerfiles', async () => {
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
