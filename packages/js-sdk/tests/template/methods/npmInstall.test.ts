import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('npm install', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .skipCache()
    .npmInstall(['lodash', 'axios'])

  await buildTemplate(template)
})

buildTemplateTest('npm install global', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .skipCache()
    .npmInstall(['tsx'], { g: true })

  await buildTemplate(template)
})

buildTemplateTest('npm install dev', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .skipCache()
    .npmInstall(['typescript'], { dev: true })

  await buildTemplate(template)
})
