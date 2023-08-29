import { Session } from '../src'
import { expect, test, vi } from 'vitest'

const E2B_API_KEY = process.env.E2B_API_KEY

test('create session', async () => {
  const session = await Session.create({ id: "Nodejs", apiKey: E2B_API_KEY })
  await session.close()
})

test('create multiple sessions', async () => {
  const session = await Session.create({ id: "Nodejs", apiKey: E2B_API_KEY })
  const session2 = await Session.create({ id: "Nodejs", apiKey: E2B_API_KEY })
  await session.close()
  await session2.close()
})
