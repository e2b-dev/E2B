import { buildTemplateTest } from '../../setup'
import { Template } from '../../../src'
import path from 'node:path'
import fs from 'node:fs'
import { afterAll, beforeAll } from 'vitest'

const fileContextPath = path.join(__dirname, 'dockerfile-context')

beforeAll(async () => {
  fs.mkdirSync(fileContextPath, { recursive: true })
  fs.writeFileSync(
    path.join(fileContextPath, 'package.json'),
    JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2),
    'utf-8'
  )
})

afterAll(async () => {
  fs.rmSync(fileContextPath, { recursive: true, force: true })
})

buildTemplateTest('fromBaseImage', async ({ buildTemplate }) => {
  const template = Template().fromBaseImage()
  await buildTemplate(template)
})

buildTemplateTest('fromDebianImage', async ({ buildTemplate }) => {
  const template = Template().fromDebianImage()
  await buildTemplate(template)
})

buildTemplateTest('fromDebianImage with variant', async ({ buildTemplate }) => {
  const template = Template().fromDebianImage('bookworm')
  await buildTemplate(template)
})

buildTemplateTest('fromUbuntuImage', async ({ buildTemplate }) => {
  const template = Template().fromUbuntuImage()
  await buildTemplate(template)
})

buildTemplateTest('fromUbuntuImage with variant', async ({ buildTemplate }) => {
  const template = Template().fromUbuntuImage('24.04')
  await buildTemplate(template)
})

buildTemplateTest('fromPythonImage', async ({ buildTemplate }) => {
  const template = Template().fromPythonImage()
  await buildTemplate(template)
})

buildTemplateTest('fromPythonImage with variant', async ({ buildTemplate }) => {
  const template = Template().fromPythonImage('3.12')
  await buildTemplate(template)
})

buildTemplateTest('fromNodeImage', async ({ buildTemplate }) => {
  const template = Template().fromNodeImage()
  await buildTemplate(template)
})

buildTemplateTest('fromNodeImage with variant', async ({ buildTemplate }) => {
  const template = Template().fromNodeImage('24')
  await buildTemplate(template)
})

buildTemplateTest('fromBunImage', async ({ buildTemplate }) => {
  const template = Template().fromBunImage()
  await buildTemplate(template)
})

buildTemplateTest('fromBunImage with variant', async ({ buildTemplate }) => {
  const template = Template().fromBunImage('1.3')
  await buildTemplate(template)
})

buildTemplateTest('fromImage', async ({ buildTemplate }) => {
  const template = Template().fromImage('ubuntu:22.04')
  await buildTemplate(template)
})

buildTemplateTest('fromTemplate', async ({ buildTemplate }) => {
  const template = Template().fromTemplate('base')
  await buildTemplate(template)
})

buildTemplateTest('fromDockerfile', async ({ buildTemplate }) => {
  const dockerfile = `FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install`

  const template = Template({ fileContextPath }).fromDockerfile(dockerfile)
  await buildTemplate(template)
})
