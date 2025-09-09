import { assert, test } from 'vitest'
import { Template, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'

test('build template', { timeout: 180000 }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .runCmd('cat folder/test.txt')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert(error.stack.split('\n')[1].includes(__filename))
  }
})
