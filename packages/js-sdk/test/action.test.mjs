import { Sandbox } from '../src'
import { test, expect } from 'vitest'

import { id } from './setup.mjs'

test('add action', async () => {
  const sandbox = await Sandbox.create({ id })

  sandbox.addAction('test', () => {
    return 'test'
  })

  expect([sandbox.actions.values()].length).toEqual(1)

  await sandbox.close()
})
