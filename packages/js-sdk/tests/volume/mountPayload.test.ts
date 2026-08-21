import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox, Volume } from '../../src'
import { apiUrl, TEST_API_KEY } from '../setup'

let lastCreateBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  lastCreateBody = undefined
  server.resetHandlers()
})

test('Sandbox.create omits volumeMounts when none are requested', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(lastCreateBody).not.toHaveProperty('volumeMounts')
})

test('Sandbox.create maps mount paths to named volume mounts', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    volumeMounts: { '/mnt/data': 'my-volume' },
  })

  expect(lastCreateBody?.volumeMounts).toEqual([
    { name: 'my-volume', path: '/mnt/data' },
  ])
})

test('Sandbox.create accepts a Volume instance as the mount source', async () => {
  const volume = new Volume('vol-1', 'my-volume', 'volume-token')

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    volumeMounts: { '/mnt/data': volume },
  })

  expect(lastCreateBody?.volumeMounts).toEqual([
    { name: 'my-volume', path: '/mnt/data' },
  ])
})
