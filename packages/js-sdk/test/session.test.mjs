import { Session } from '../src'
import { expect, test, vi } from 'vitest'

test('create session', async () => {
  const session = await Session.create({ id: "Nodejs" })
  await session.close()
})

test('create multiple sessions', async () => {
  const session = await Session.create({ id: "Nodejs" })
  const session2 = await Session.create({ id: "Nodejs" })
  await session.close()
  await session2.close()
})
