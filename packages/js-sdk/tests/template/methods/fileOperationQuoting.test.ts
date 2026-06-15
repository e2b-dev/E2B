import { expect, test, describe } from 'vitest'
import { Template } from '../../../src'

describe('file operation helpers quote paths', () => {
  test('remove quotes paths with special characters', () => {
    const template = Template()
      .fromUbuntuImage('24.04')
      .remove(['/tmp/my file', '/tmp/plain'], { recursive: true, force: true })

    const dockerfile = Template.toDockerfile(template)

    expect(dockerfile).toContain("RUN rm -r -f '/tmp/my file' /tmp/plain\n")
  })

  test('rename quotes paths with special characters', () => {
    const template = Template()
      .fromUbuntuImage('24.04')
      .rename('/tmp/old name', '/tmp/new name')

    const dockerfile = Template.toDockerfile(template)

    expect(dockerfile).toContain("RUN mv '/tmp/old name' '/tmp/new name'\n")
  })

  test('makeDir quotes paths with special characters', () => {
    const template = Template()
      .fromUbuntuImage('24.04')
      .makeDir('/app/my data', { mode: 0o755 })

    const dockerfile = Template.toDockerfile(template)

    expect(dockerfile).toContain("RUN mkdir -p -m 0755 '/app/my data'\n")
  })

  test('makeSymlink quotes paths with special characters', () => {
    const template = Template()
      .fromUbuntuImage('24.04')
      .makeSymlink('/usr/bin/python3', '/usr/local/bin/my python')

    const dockerfile = Template.toDockerfile(template)

    expect(dockerfile).toContain(
      "RUN ln -s /usr/bin/python3 '/usr/local/bin/my python'\n"
    )
  })

  test('plain paths stay unquoted', () => {
    const template = Template()
      .fromUbuntuImage('24.04')
      .remove('/tmp/cache', { recursive: true })
      .rename('/tmp/a', '/tmp/b')
      .makeDir('/app/data')
      .makeSymlink('/usr/bin/python3', '/usr/bin/python')

    const dockerfile = Template.toDockerfile(template)

    expect(dockerfile).toContain('RUN rm -r /tmp/cache\n')
    expect(dockerfile).toContain('RUN mv /tmp/a /tmp/b\n')
    expect(dockerfile).toContain('RUN mkdir -p /app/data\n')
    expect(dockerfile).toContain('RUN ln -s /usr/bin/python3 /usr/bin/python\n')
  })
})
