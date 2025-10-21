import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'

buildTemplateTest('make symlink', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .makeSymlink('.bashrc', '.bashrc.local')

  await buildTemplate(template)
})

buildTemplateTest('make symlink (force)', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .makeSymlink('.bashrc', '.bashrc.local', { force: true })

  await buildTemplate(template)
})
