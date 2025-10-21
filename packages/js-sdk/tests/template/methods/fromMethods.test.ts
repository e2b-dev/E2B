import { buildTemplateTest } from '../../setup'
import { Template } from '../../../src'
import path from 'node:path'
import fs from 'node:fs'

buildTemplateTest(
  'fromBaseImage',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromBaseImage()
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromDebianImage',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromDebianImage()
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromDebianImage with variant',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromDebianImage('bookworm')
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromUbuntuImage',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromUbuntuImage()
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromUbuntuImage with variant',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromUbuntuImage('24.04')
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromPythonImage',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromPythonImage()
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromPythonImage with variant',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromPythonImage('3.12')
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromNodeImage',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromNodeImage()
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromNodeImage with variant',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromNodeImage('24')
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromImage',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromImage('ubuntu:22.04')
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromTemplate',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template().fromTemplate('base')
    await buildTemplate(template)
  }
)

buildTemplateTest(
  'fromDockerfile',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const dockerfile = `FROM node:24
WORKDIR /app
COPY . .
RUN npm install`

    const fileContextPath = path.join(__dirname, 'dockerfile-context')
    fs.mkdirSync(fileContextPath, { recursive: true })
    fs.writeFileSync(
      path.join(fileContextPath, 'package.json'),
      JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2),
      'utf-8'
    )

    const template = Template({ fileContextPath }).fromDockerfile(dockerfile)
    await buildTemplate(template)

    fs.rmSync(fileContextPath, { recursive: true, force: true })
  }
)

// registry methods
// buildTemplateTest(
//   'fromGCPRegistry',
//   { timeout: 180000 },
//   async ({ buildTemplate }) => {
//     const template = Template().fromGCPRegistry(
//       'gcr.io/myproject/myimage:latest',
//       { serviceAccountJSON: 'path/to/service-account.json' }
//     )
//     await buildTemplate(template)
//   }
// )

// buildTemplateTest(
//   'fromAWSRegistry',
//   { timeout: 180000 },
//   async ({ buildTemplate }) => {
//     const template = Template().fromAWSRegistry(
//       '123456789.dkr.ecr.us-west-2.amazonaws.com/myimage:latest',
//       { accessKeyId: 'AKIA...', secretAccessKey: '...', region: 'us-west-2' }
//     )
//     await buildTemplate(template)
//   }
// )

// buildTemplateTest(
//   'fromImage',
//   { timeout: 180000 },
//   async ({ buildTemplate }) => {
//     const template = Template().fromImage('myregistry.com/myimage:latest', {
//       username: 'user',
//       password: 'pass',
//     })
//     await buildTemplate(template)
//   }
// )
