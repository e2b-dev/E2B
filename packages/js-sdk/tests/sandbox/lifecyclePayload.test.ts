import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { apiUrl } from '../setup'

let requestBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    requestBody = (await request.clone().json()) as Record<string, unknown>

    return HttpResponse.json({
      sandboxID: 'sbx_mock',
      domain: 'sandbox.e2b.app',
      envdVersion: '0.2.0',
      envdAccessToken: 'envd-access-token',
      trafficAccessToken: 'traffic-access-token',
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  requestBody = undefined
  server.resetHandlers()
})

afterAll(() => server.close())

test('sends autoPause false by default and omits autoResume', async () => {
  await Sandbox.create('base')

  expect(requestBody).toBeDefined()
  expect(requestBody).toMatchObject({ autoPause: false })
  expect(requestBody).not.toHaveProperty('autoResume')
})

test('omits autoResume when lifecycle.onTimeout is kill', async () => {
  await Sandbox.create('base', {
    lifecycle: {
      onTimeout: 'kill',
      autoResume: false,
    },
  })

  expect(requestBody).toBeDefined()
  expect(requestBody).toMatchObject({ autoPause: false })
  expect(requestBody).not.toHaveProperty('autoResume')
})

test('includes autoResume off when lifecycle.onTimeout is pause', async () => {
  await Sandbox.create('base', {
    lifecycle: {
      onTimeout: 'pause',
    },
  })

  expect(requestBody).toBeDefined()
  expect(requestBody).toMatchObject({
    autoPause: true,
    autoResume: {
      policy: 'off',
    },
  })
})
