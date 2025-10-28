import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('bun install', async ({ buildTemplate }) => {
  const template = Template()
    .fromBunImage('1.3')
    .bunInstall(['lodash', 'axios'])

  await buildTemplate(template)
})

buildTemplateTest('bun install global', async ({ buildTemplate }) => {
  const template = Template()
    .fromBunImage('1.3')
    .bunInstall(['tsx'], { g: true })

  await buildTemplate(template)
})

buildTemplateTest('bun install dev', async ({ buildTemplate }) => {
  const template = Template()
    .fromBunImage('1.3')
    .bunInstall(['typescript'], { dev: true })

  await buildTemplate(template)
})
