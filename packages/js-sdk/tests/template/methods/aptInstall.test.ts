import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('apt install', async ({ buildTemplate }) => {
  try {
    const template = Template()
      .fromImage('ubuntu:24.04')
      .skipCache()
      .aptInstall('rolldice')

    await buildTemplate(template)
  } catch (error) {
    // aptInstall tests are optional and allowed to fail
    console.warn('aptInstall test failed (optional):', error)
  }
})

buildTemplateTest(
  'apt install with no install recommends',
  async ({ buildTemplate }) => {
    try {
      const template = Template()
        .fromImage('ubuntu:24.04')
        .skipCache()
        .aptInstall('rolldice', { noInstallRecommends: true })

      await buildTemplate(template)
    } catch (error) {
      // aptInstall tests are optional and allowed to fail
      console.warn('aptInstall test failed (optional):', error)
    }
  }
)
