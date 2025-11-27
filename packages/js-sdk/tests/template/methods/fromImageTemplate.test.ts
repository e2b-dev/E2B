import { buildTemplateTest } from '../../setup'
import { Template } from '../../../src'
import { InstructionType } from '../../../src/template/types'
import path from 'node:path'
import fs from 'node:fs'
import { afterAll, beforeAll, assert } from 'vitest'

const fileContextPath = path.join(__dirname, 'dockerfile-context')

beforeAll(async () => {
  fs.mkdirSync(fileContextPath, { recursive: true })
  fs.writeFileSync(
    path.join(fileContextPath, 'package.json'),
    JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2),
    'utf-8'
  )
})

afterAll(async () => {
  fs.rmSync(fileContextPath, { recursive: true, force: true })
})

buildTemplateTest('fromImage', async ({ buildTemplate }) => {
  const template = Template().fromImage('e2bdev/base')
  await buildTemplate(template, { skipCache: true })
})

buildTemplateTest('fromTemplate', async ({ buildTemplate }) => {
  const template = Template().fromTemplate('base')
  await buildTemplate(template, { skipCache: true })
})
