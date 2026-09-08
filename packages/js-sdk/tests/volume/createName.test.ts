import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Volume } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

const server = setupServer(
  http.post(apiUrl('/volumes'), () => {
    throw new Error('POST should not be called')
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe('Volume.create name validation', () => {
  it.each(['', 'vol name', 'vol.name', 'vol/a', '{x}'])(
    'should throw InvalidArgumentError for invalid name %j',
    async (name) => {
      await expect(
        Volume.create(name, { apiKey: TEST_API_KEY })
      ).rejects.toThrow(InvalidArgumentError)
    }
  )

  it('should throw InvalidArgumentError without an API key', async () => {
    const previous = process.env.E2B_API_KEY
    delete process.env.E2B_API_KEY
    try {
      await expect(Volume.create('')).rejects.toThrow(InvalidArgumentError)
    } finally {
      if (previous === undefined) {
        delete process.env.E2B_API_KEY
      } else {
        process.env.E2B_API_KEY = previous
      }
    }
  })
})
