import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { ApiClient } from '../../src/api'
import { ConnectionConfig } from '../../src/connectionConfig'
import { requestBuild } from '../../src/template/buildApi'
import { TEST_API_KEY, apiUrl } from '../setup'

let lastBuildBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/v3/templates'), async ({ request }) => {
    lastBuildBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      templateID: 'test-template-id',
      buildID: 'test-build-id',
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastBuildBody = undefined
  server.resetHandlers()
})

function client() {
  return new ApiClient(new ConnectionConfig({ apiKey: TEST_API_KEY }))
}

test('template build request omits cpuCount and memoryMB when unset', async () => {
  await requestBuild(client(), { name: 'test-template' })

  expect(lastBuildBody).toBeDefined()
  expect(lastBuildBody).not.toHaveProperty('cpuCount')
  expect(lastBuildBody).not.toHaveProperty('memoryMB')
})

test('template build request sends explicit cpuCount and memoryMB', async () => {
  await requestBuild(client(), {
    name: 'test-template',
    cpuCount: 1,
    memoryMB: 512,
  })

  expect(lastBuildBody?.cpuCount).toBe(1)
  expect(lastBuildBody?.memoryMB).toBe(512)
})
