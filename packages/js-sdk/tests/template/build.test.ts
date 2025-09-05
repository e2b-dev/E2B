import { test } from 'vitest'
import { Template, ReadyCmd } from '../../src'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'

test('build template', { timeout: 180000 }, async () => {
  const folderPath = path.join(__dirname, 'folder')
  fs.mkdirSync(folderPath, { recursive: true })
  fs.writeFileSync(path.join(folderPath, 'test.txt'), 'This is a test file.')

  const template = Template()
    .fromImage('ubuntu:22.04')
    .copy('folder/*.txt', 'folder', { forceUpload: true })
    .setEnvs({
      ENV_1: 'value1',
      ENV_2: 'value2',
    })
    .runCmd('cat folder/test.txt')
    .setWorkdir('/app')
    .setStartCmd('echo "Hello, world!"', ReadyCmd.waitForTimeout(10_000))

  await Template.build(template, {
    alias: randomUUID(),
    cpuCount: 1,
    memoryMB: 1024,
  })

  fs.rmSync(folderPath, { recursive: true })
})
