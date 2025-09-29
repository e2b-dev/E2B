import { randomUUID } from 'node:crypto'
import { test } from 'vitest'
import { Template } from '../../../src'

test('pip install', { timeout: 180000 }, async () => {
  const template = Template()
    .fromPythonImage('3.13.7-trixie')
    .pipInstall(['six', 'pyyaml'])

  await Template.build(template, {
    alias: randomUUID(),
  })
})
