import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll } from 'vitest'
import { defaultBuildLogger, Template, waitForTimeout } from '../../src'
import { buildTemplateTest } from '../setup'

const folderPath = path.join(__dirname, 'folder')

beforeAll(async () => {
  fs.mkdirSync(folderPath, { recursive: true })
  fs.writeFileSync(path.join(folderPath, 'test.txt'), 'This is a test file.')

  // Create relative symlink
  fs.symlinkSync('test.txt', path.join(folderPath, 'symlink.txt'))

  // Create absolute symlink
  fs.symlinkSync(
    path.join(folderPath, 'test.txt'),
    path.join(folderPath, 'symlink2.txt')
  )

  // Create a symlink to a file that does not exist
  fs.symlinkSync('12345test.txt', path.join(folderPath, 'symlink3.txt'))
})

afterAll(() => {
  fs.rmSync(folderPath, { recursive: true })
})

buildTemplateTest('build template', async ({ buildTemplate }) => {
  const template = Template()
    // using base image to avoid re-building ubuntu:22.04 image
    .fromBaseImage()
    .copy('folder/*', 'folder', { forceUpload: true })
    .runCmd('cat folder/test.txt')
    .setWorkdir('/app')
    .setStartCmd('echo "Hello, world!"', waitForTimeout(10_000))

  await buildTemplate(template, { skipCache: true }, defaultBuildLogger())
})

buildTemplateTest(
  'build template from base template',
  async ({ buildTemplate }) => {
    const template = Template().fromTemplate('base')
    await buildTemplate(template, { skipCache: true })
  }
)

buildTemplateTest('build template with symlinks', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .skipCache()
    .copy('folder/*', 'folder', { forceUpload: true })
    .runCmd('cat folder/symlink.txt')

  await buildTemplate(template)
})

buildTemplateTest(
  'build template with resolveSymlinks',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .skipCache()
      .copy('folder/symlink.txt', 'folder/symlink.txt', {
        forceUpload: true,
        resolveSymlinks: true,
      })
      .runCmd('cat folder/symlink.txt')

    await buildTemplate(template)
  }
)
