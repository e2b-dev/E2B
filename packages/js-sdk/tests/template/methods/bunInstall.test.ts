import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('bun install', async ({ buildTemplate }) => {
  const template = Template()
    .fromBunImage('1.3')
    .skipCache()
    .bunInstall('left-pad')

  await buildTemplate(template)
})

buildTemplateTest('bun install global', async ({ buildTemplate }) => {
  const template = Template()
    .fromBunImage('1.3')
    .skipCache()
    .bunInstall('left-pad', { g: true })

  await buildTemplate(template)
})

buildTemplateTest('bun install dev', async ({ buildTemplate }) => {
  const template = Template()
    .fromBunImage('1.3')
    .skipCache()
    .bunInstall('left-pad', { dev: true })

  await buildTemplate(template)
})
