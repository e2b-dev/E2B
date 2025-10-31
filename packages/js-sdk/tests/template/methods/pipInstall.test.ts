import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('pip install', async ({ buildTemplate }) => {
  const template = Template()
    .fromPythonImage('3.13.7-trixie')
    .pipInstall(['six', 'pyyaml'])

  await buildTemplate(template)
})

buildTemplateTest('pip install (user)', async ({ buildTemplate }) => {
  const template = Template()
    .fromPythonImage('3.13.7-trixie')
    .pipInstall(['six', 'pyyaml'], { g: false })

  await buildTemplate(template)
})
