import { Template } from '../../../src'
import { allowFail, buildTemplateTest } from '../../setup'

buildTemplateTest(
  'apt install',
  allowFail(async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:24.04')
      .skipCache()
      .aptInstall('rolldice')

    await buildTemplate(template)
  })
)

buildTemplateTest(
  'apt install with no install recommends',
  allowFail(async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:24.04')
      .skipCache()
      .aptInstall('rolldice', { noInstallRecommends: true })

    await buildTemplate(template)
  })
)
