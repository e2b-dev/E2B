import { expect, test } from 'vitest'
import { Template } from '../../../src'

test('toDockerfile', { timeout: 180000 }, async () => {
  const template = Template()
    .fromUbuntuImage('24.04')
    .copy('README.md', '/app/README.md')
    .runCmd('echo "Hello, World!"')

  const dockerfile = Template.toDockerfile(template)

  const expectedDockerfile = `FROM ubuntu:24.04
COPY README.md /app/README.md
RUN echo "Hello, World!"
`
  expect(dockerfile).toBe(expectedDockerfile)
})

test('toDockerfile with options', { timeout: 180000 }, async () => {
  const template = Template()
    .fromUbuntuImage('24.04')
    .copy('README.md', '/app/README.md', { user: 'root' })
    .runCmd('echo "Hello, World!"', { user: 'root' })

  const dockerfile = Template.toDockerfile(template)

  const expectedDockerfile = `FROM ubuntu:24.04
COPY README.md /app/README.md
RUN echo "Hello, World!"
`
  expect(dockerfile).toBe(expectedDockerfile)
})

test('toDockerfile with ENV instructions', { timeout: 180000 }, async () => {
  const template = Template()
    .fromUbuntuImage('24.04')
    .setEnvs({ NODE_ENV: 'production', PORT: '8080' })
    .setEnvs({ DEBUG: 'false' })

  const dockerfile = Template.toDockerfile(template)

  const expectedDockerfile = `FROM ubuntu:24.04
ENV NODE_ENV=production PORT=8080
ENV DEBUG=false
`
  expect(dockerfile).toBe(expectedDockerfile)
})
