import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('pip install', async ({ buildTemplate }) => {
  const template = Template()
    .fromPythonImage('3.13.7-trixie')
    .skipCache()
    .pipInstall('pip-install-test')

  await buildTemplate(template)
})

buildTemplateTest('pip install (user)', async ({ buildTemplate }) => {
  const template = Template()
    .fromPythonImage('3.13.7-trixie')
    .skipCache()
    .pipInstall('pip-install-test', { g: false })

  await buildTemplate(template)
})
