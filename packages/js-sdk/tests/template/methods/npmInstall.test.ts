import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('npm install', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .skipCache()
    .npmInstall('left-pad')

  await buildTemplate(template)
})

buildTemplateTest('npm install global', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .skipCache()
    .npmInstall('left-pad', { g: true })

  await buildTemplate(template)
})

buildTemplateTest('npm install dev', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .skipCache()
    .npmInstall('left-pad', { dev: true })

  await buildTemplate(template)
})
