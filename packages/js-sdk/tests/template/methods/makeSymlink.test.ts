import { Template } from '../../../src'
import { e2eBuildTemplateTest } from '../../setup'

e2eBuildTemplateTest('make symlink', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .skipCache()
    .makeSymlink('.bashrc', '.bashrc.local')
    .runCmd('test "$(readlink .bashrc.local)" = ".bashrc"')

  await buildTemplate(template)
})

e2eBuildTemplateTest('make symlink (force)', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .makeSymlink('.bashrc', '.bashrc.local')
    .skipCache()
    .makeSymlink('.bashrc', '.bashrc.local', { force: true }) // Overwrite existing symlink
    .runCmd('test "$(readlink .bashrc.local)" = ".bashrc"')

  await buildTemplate(template)
})
