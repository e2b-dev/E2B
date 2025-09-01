import { test } from 'vitest'
import { Template, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'

test('build template', { timeout: 180000 }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .copy('folder/*.txt', 'folder', { forceUpload: true })
    .setEnvs({
      ENV_1: 'value1',
      ENV_2: 'value2',
    })
    .runCmd('cat folder/test.txt')
    .setWorkdir('/app')
    .setStartCmd('echo "Hello, world!"', waitForTimeout('10s'))

  await Template.build(template, {
    alias: randomUUID(),
    cpuCount: 1,
    memoryMB: 1024,
    onBuildLogs: (logEntry) => console.log(logEntry.toString()),
  })
})
