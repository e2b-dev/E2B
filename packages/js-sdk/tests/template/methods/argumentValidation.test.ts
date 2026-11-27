import { describe, expect, test } from 'vitest'

import { InvalidArgumentError, Template } from '../../../src'

// Arguments the builder writes into a shell command before the API sees them.
// `Template.toDockerfile` shows the command each method produced.

const base = () => Template().fromImage('ubuntu:22.04')
const runLines = (template: ReturnType<typeof base>) =>
  Template.toDockerfile(template)
    .split('\n')
    .filter((line) => line.startsWith('RUN '))
const untyped = (value: unknown) => value as any

describe('package arguments', () => {
  test.each([
    ['pipInstall', 'RUN pip install'],
    ['npmInstall', 'RUN npm install'],
    ['bunInstall', 'RUN bun install'],
  ] as const)(
    '%s quotes a version range the shell would read as a redirect',
    (method, command) => {
      const template = base()[method](['left>=2', 'right<3', 'plain==1.0'])

      expect(runLines(template)).toEqual([
        `${command} 'left>=2' 'right<3' plain==1.0`,
      ])
    }
  )

  test('aptInstall quotes a version range', () => {
    const template = base().aptInstall(['curl', 'libfoo>=2'])

    expect(runLines(template).at(-1)).toMatch(/ install -y curl 'libfoo>=2'$/)
  })

  test.each([
    ['an exclusion', 'numpy!=1.5,<2', "'numpy!=1.5,<2'"],
    ['a command separator', 'numpy;reboot', "'numpy;reboot'"],
    ['a pipe', 'numpy|sh', "'numpy|sh'"],
  ])('pipInstall quotes %s', (_, given, written) => {
    expect(runLines(base().pipInstall(given))).toEqual([
      `RUN pip install ${written}`,
    ])
  })

  // Only an argument the shell would split or redirect is rewritten, so the
  // command of a template that builds today, and with it its cache, is kept.
  test.each([
    ['extras', 'requests[socks]'],
    ['a wildcard', 'torch==2.*'],
    ['a compatible release', 'numpy~=1.26'],
    ['a scoped npm range', '@scope/pkg@^1.2.0'],
    ['several words', '-r requirements.txt'],
    ['an argument quoted by the caller', '"numpy>=2"'],
    ['an environment marker', "numpy; python_version<'3.9'"],
    ['a variable', '$PACKAGE'],
    ['a plain name', 'numpy'],
  ])('pipInstall writes %s as it was given', (_, given) => {
    expect(runLines(base().pipInstall(given))).toEqual([
      `RUN pip install ${given}`,
    ])
  })
})

describe('numbers written into a command', () => {
  const noMode = [[NaN], [-1], [0o10000], [755.5], ['755']]

  test.each(noMode)('copy refuses mode %j', (mode) => {
    expect(() =>
      base().copy('file.txt', '/app/', { mode: untyped(mode) })
    ).toThrow(InvalidArgumentError)
  })

  test.each(noMode)('makeDir refuses mode %j', (mode) => {
    expect(() => base().makeDir('/app', { mode: untyped(mode) })).toThrow(
      InvalidArgumentError
    )
  })

  test('makeDir writes the mode in octal', () => {
    expect(runLines(base().makeDir('/app', { mode: 0o755 }))).toEqual([
      'RUN mkdir -p -m 0755 /app',
    ])
  })

  test.each([[-1], [1.5], ['1; rm -rf /']])(
    'gitClone refuses depth %j',
    (depth) => {
      expect(() =>
        base().gitClone('https://example.com/repo.git', undefined, {
          depth: untyped(depth),
        })
      ).toThrow(InvalidArgumentError)
    }
  )

  test('gitClone writes a positive depth', () => {
    const template = base().gitClone('https://example.com/repo.git', '/repo', {
      depth: 1,
    })

    expect(runLines(template)).toEqual([
      'RUN git clone https://example.com/repo.git --depth 1 /repo',
    ])
  })
})
