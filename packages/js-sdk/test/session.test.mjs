import { Session } from '../src'
import { test } from 'vitest'

import { id } from './setup.mjs'

test('create session', async () => {
  const session = await Session.create({ id })
  await session.close()
})

test('create multiple sessions', async () => {
  const session = await Session.create({ id })
  const session2 = await Session.create({ id })
  await session.close()
  await session2.close()
})
