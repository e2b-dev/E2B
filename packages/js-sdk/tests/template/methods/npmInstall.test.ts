import { randomUUID } from 'node:crypto'
import { test } from 'vitest'
import { Template } from '../../../src'

test('npm install', { timeout: 180000 }, async () => {
  const template = Template().fromNodeImage('24').npmInstall(['lodash', 'ms'])

  await Template.build(template, {
    alias: randomUUID(),
  })
})

test('npm install global', { timeout: 180000 }, async () => {
  const template = Template()
    .fromNodeImage('24')
    .npmInstall(['lodash', 'ms'], { g: true })

  await Template.build(template, {
    alias: randomUUID(),
  })
})
