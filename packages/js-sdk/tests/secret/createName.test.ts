import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Secret } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

const server = setupServer(
  http.post(apiUrl('/secrets'), () => {
    throw new Error('POST should not be called')
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe('Secret.create name validation', () => {
  it.each(['', '{name', 'name}', 'name\n', 'name\x00'])(
    'should throw InvalidArgumentError for invalid name %j',
    async (name) => {
      await expect(
        Secret.create(name, 'v', { apiKey: TEST_API_KEY })
      ).rejects.toThrow(InvalidArgumentError)
    }
  )

  it('should throw InvalidArgumentError without an API key', async () => {
    const previous = process.env.E2B_API_KEY
    delete process.env.E2B_API_KEY
    try {
      await expect(Secret.create('', 'v')).rejects.toThrow(InvalidArgumentError)
    } finally {
      if (previous === undefined) {
        delete process.env.E2B_API_KEY
      } else {
        process.env.E2B_API_KEY = previous
      }
    }
  })
})
