import { Template } from '../../../src'
import { buildTemplateTestAllowFail } from '../../setup'

buildTemplateTestAllowFail(
  'apt install',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:24.04')
      .skipCache()
      .aptInstall('rolldice')

    await buildTemplate(template)
  },
  'aptInstall tests are optional and allowed to fail'
)

buildTemplateTestAllowFail(
  'apt install with no install recommends',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:24.04')
      .skipCache()
      .aptInstall('rolldice', { noInstallRecommends: true })

    await buildTemplate(template)
  },
  'aptInstall tests are optional and allowed to fail'
)
