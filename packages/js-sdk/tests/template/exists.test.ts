import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { setupServer } from 'msw/node'
import { Template } from '../../src'
import { TEST_API_KEY } from '../setup'
import { createMockBuildApi } from './mockBuildApi'

const server = setupServer(...createMockBuildApi().handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

// The placeholder key keeps the mocked template tests independent of
// E2B_API_KEY being set in the environment.
const apiKey = process.env.E2B_API_KEY ?? TEST_API_KEY

test('check if base template name exists', async () => {
  const exists = await Template.exists('base', { apiKey })
  expect(exists).toBe(true)
})

test('check non existing name', async () => {
  const nonExistingName = `nonexistent-${randomUUID()}`
  const exists = await Template.exists(nonExistingName, { apiKey })
  expect(exists).toBe(false)
})
