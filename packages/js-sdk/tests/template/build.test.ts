import { afterAll, beforeAll } from 'vitest'
import { buildTemplateTest } from '../setup'
import { Template, waitForTimeout } from '../../src'
import path from 'node:path'
import fs from 'node:fs'

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

buildTemplateTest(
  'build template',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .copy('folder/*', 'folder', { forceUpload: true })
      .runCmd('cat folder/test.txt')
      .setWorkdir('/app')
      .setStartCmd('echo "Hello, world!"', waitForTimeout(10_000))

    await buildTemplate(template)
  }
)

buildTemplateTest(
  'build template with symlinks',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .copy('folder/*', 'folder', { forceUpload: true })
      .runCmd('cat folder/symlink.txt')

    await buildTemplate(template)
  }
)

buildTemplateTest(
  'build template with resolveSymlinks',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .copy('folder/symlink.txt', 'folder/symlink.txt', {
        forceUpload: true,
        resolveSymlinks: true,
      })
      .runCmd('cat folder/symlink.txt')

    await buildTemplate(template)
  }
)

buildTemplateTest(
  'build template with skipCache',
  { timeout: 180000 },
  async ({ buildTemplate }) => {
    const template = Template()
      .skipCache()
      .fromImage('ubuntu:22.04')
      .setStartCmd('echo "Hello, world!"', waitForTimeout(10_000))

    await buildTemplate(template)
  }
)
