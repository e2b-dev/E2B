import { Session } from '../src'
import { expect, test } from 'vitest'

const E2B_API_KEY = process.env.E2B_API_KEY

// Smoke test = quick, high-level, basic functionality test
test('Smoke test', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })
  await session.filesystem.makeDir('/test/new')

  const ls = await session.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['new'])

  await session.close()
})
