import { Sandbox } from '../src'
import { test, expect } from 'vitest'

import { id } from './setup.mjs'

test('register action', async () => {
  const sandbox = await Sandbox.create({ id })

  sandbox.registerAction('test', () => {
    return 'test'
  })

  expect([sandbox.actions.values()].length).toEqual(1)

  await sandbox.close()
})
