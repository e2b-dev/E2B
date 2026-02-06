import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { apiUrl } from '../setup'

const templateId = 'test-template'
const sandboxResponse = {
  templateID: templateId,
  sandboxID: 'sandbox-123',
  clientID: 'client-123',
  envdVersion: '0.2.4',
  envdAccessToken: 'envd-access-token',
  trafficAccessToken: null,
  domain: 'e2b.app',
}

let lastBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastBody = (await request.clone().json()) as Record<string, unknown>
    return HttpResponse.json(sandboxResponse, { status: 201 })
  })
)

describe('Sandbox.create autoResume', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => server.close())
  afterEach(() => {
    lastBody = undefined
    server.resetHandlers()
  })

  test('sends autoResume when provided', async () => {
    await Sandbox.create(templateId, {
      apiKey: 'test-api-key',
      autoResume: { policy: 'any' },
      apiUrl: apiUrl(''),
      debug: false,
    })

    expect(lastBody?.autoResume).toEqual({ policy: 'any' })
  })

  test('omits autoResume when not provided', async () => {
    await Sandbox.create(templateId, {
      apiKey: 'test-api-key',
      apiUrl: apiUrl(''),
      debug: false,
    })

    expect(lastBody).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(lastBody, 'autoResume')).toBe(
      false
    )
  })

  test('omits autoResume when null', async () => {
    await Sandbox.create(templateId, {
      apiKey: 'test-api-key',
      autoResume: null,
      apiUrl: apiUrl(''),
      debug: false,
    })

    expect(lastBody).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(lastBody, 'autoResume')).toBe(
      false
    )
  })
})
