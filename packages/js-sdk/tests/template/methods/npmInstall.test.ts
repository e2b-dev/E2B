import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('npm install', async ({ buildTemplate }) => {
  const template = Template().fromNodeImage('24').npmInstall(['lodash', 'ms'])

  await buildTemplate(template)
})

buildTemplateTest('npm install global', async ({ buildTemplate }) => {
  const template = Template()
    .fromNodeImage('24')
    .npmInstall(['lodash', 'ms'], { g: true })

  await buildTemplate(template)
})
