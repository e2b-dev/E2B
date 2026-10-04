import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

let metadataFilter: string | null | undefined

const server = setupMockApi(
  http.get(apiUrl('/v2/sandboxes'), ({ request }) => {
    metadataFilter = new URL(request.url).searchParams.get('metadata')
    return HttpResponse.json([])
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  metadataFilter = undefined
  server.resetHandlers()
})

test('Sandbox.list URL-encodes metadata keys and values once', async () => {
  await Sandbox.list({
    query: {
      metadata: { 'team/slug!': 'hello & 100% 😀', version: 'v=2' },
    },
    apiKey: TEST_API_KEY,
  }).nextItems()

  expect(metadataFilter).toBe(
    'team%2Fslug!=hello%20%26%20100%25%20%F0%9F%98%80&version=v%3D2'
  )
})
