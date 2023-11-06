import { Sandbox } from '../src'
import { test } from 'vitest'

import { id } from './setup.mjs'

test('create sandbox', async () => {
  const sandbox = await Sandbox.create({ id })
  await sandbox.close()
})

test('create multiple sandbox', async () => {
  const sandbox = await Sandbox.create({ id })
  const sandbox2 = await Sandbox.create({ id })
  await sandbox.close()
  await sandbox2.close()
})
