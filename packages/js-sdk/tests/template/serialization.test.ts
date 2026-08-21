import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, assert, beforeAll, expect, test } from 'vitest'

import { Template } from '../../src'
import { InstructionType } from '../../src/template/types'
import { calculateFilesHash } from '../../src/template/utils'

let contextPath: string

beforeAll(async () => {
  contextPath = await mkdtemp(join(tmpdir(), 'template-serialization-'))
  await writeFile(join(contextPath, 'app.txt'), 'hello')
  await writeFile(join(contextPath, 'other.txt'), 'hello')
})

afterAll(async () => {
  await rm(contextPath, { recursive: true, force: true })
})

const filesHash = (src: string, dest: string) =>
  calculateFilesHash(src, dest, contextPath, [], false, undefined)

test('hash is stable and content-dependent', async () => {
  const before = await filesHash('app.txt', '/app/')
  assert.equal(await filesHash('app.txt', '/app/'), before)

  await writeFile(join(contextPath, 'app.txt'), 'hello again')
  const after = await filesHash('app.txt', '/app/')

  assert.notEqual(after, before)
  assert.match(after, /^[0-9a-f]{64}$/)
})

test('hash covers the source and destination paths', async () => {
  // Identical content, different instruction — the hash seeds on `COPY src dest`.
  assert.notEqual(
    await filesHash('app.txt', '/app/'),
    await filesHash('other.txt', '/app/')
  )
  assert.notEqual(
    await filesHash('app.txt', '/app/'),
    await filesHash('app.txt', '/srv/')
  )
})

test('hashing a source that matches no file fails', async () => {
  // TODO: should reject with TemplateError once calculateFilesHash stops
  // throwing a bare Error.
  await expect(filesHash('nope.txt', '/app/')).rejects.toThrow()
})

test('serializes a build payload from the builder', async () => {
  const template = Template({ fileContextPath: contextPath })
    .fromImage('ubuntu:22.04')
    .runCmd('echo hello')
    .setWorkdir('/app')
    .setStartCmd('python main.py', 'curl -f http://localhost:8000')

  const payload = JSON.parse(await Template.toJSON(template, false))

  assert.equal(payload.fromImage, 'ubuntu:22.04')
  assert.equal(payload.startCmd, 'python main.py')
  assert.equal(payload.readyCmd, 'curl -f http://localhost:8000')
  assert.isUndefined(payload.fromTemplate)
  assert.deepEqual(
    payload.steps.map((step: { type: string }) => step.type),
    [InstructionType.RUN, InstructionType.WORKDIR]
  )
})

test('serializes fromTemplate instead of fromImage', async () => {
  const payload = JSON.parse(
    await Template.toJSON(Template().fromTemplate('base'))
  )

  assert.equal(payload.fromTemplate, 'base')
  assert.isUndefined(payload.fromImage)
})

test('serializes a registry config next to the image', async () => {
  const template = Template().fromImage('registry.example.com/app:latest', {
    username: 'user',
    password: 'pass',
  })

  const payload = JSON.parse(await Template.toJSON(template))

  assert.equal(payload.fromImage, 'registry.example.com/app:latest')
  assert.equal(payload.fromImageRegistry.type, 'registry')
  assert.equal(payload.fromImageRegistry.username, 'user')
})

test('computeHashes adds the copy hash to the payload', async () => {
  const template = Template({ fileContextPath: contextPath })
    .fromImage('ubuntu:22.04')
    .copy('app.txt', '/app/')

  const withoutHashes = JSON.parse(await Template.toJSON(template, false))
  const withHashes = JSON.parse(await Template.toJSON(template, true))

  const copyStep = (payload: {
    steps: { type: string; filesHash?: string }[]
  }) => payload.steps.find((step) => step.type === InstructionType.COPY)

  assert.isUndefined(copyStep(withoutHashes)?.filesHash)
  assert.equal(
    copyStep(withHashes)?.filesHash,
    await filesHash('app.txt', '/app/')
  )
})
