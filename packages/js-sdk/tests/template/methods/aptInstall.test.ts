import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

// Mark tests as expected to fail (similar to pytest's @pytest.mark.xfail(strict=True))
// Unlike try-catch which silently swallows errors, .fails() properly reports test results:
// - If test fails as expected → test passes (XFAIL behavior)
// - If test unexpectedly passes → test fails, signaling the issue may be fixed

buildTemplateTest.fails('apt install', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:24.04')
    .skipCache()
    .aptInstall('rolldice')

  await buildTemplate(template)
})

buildTemplateTest.fails(
  'apt install with no install recommends',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:24.04')
      .skipCache()
      .aptInstall('rolldice', { noInstallRecommends: true })

    await buildTemplate(template)
  }
)
