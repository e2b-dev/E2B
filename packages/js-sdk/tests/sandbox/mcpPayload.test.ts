import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

// The generated `mcp.d.ts` types describe what a caller may put in the `mcp`
// mapping; these pin what `Sandbox.create` then does with it — which template it
// picks and what reaches the API — without a live sandbox.

let lastCreateBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.delete(apiUrl('/sandboxes/test-sandbox-id'), () =>
    HttpResponse.json({}, { status: 204 })
  ),
  // The gateway command is run over envd. Failing it here keeps the create call
  // offline and makes the rejection deterministic.
  http.post('*/process.Process/Start', () =>
    HttpResponse.json(
      { code: 'internal', message: 'no mcp-gateway binary' },
      { status: 500 }
    )
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  server.resetHandlers()
})

test('an mcp mapping selects the gateway template and reaches the request body', async () => {
  // The gateway command itself needs a live sandbox, so the create call rejects
  // once the request under test has been sent.
  await expect(
    Sandbox.create({ apiKey: TEST_API_KEY, mcp: { docker: {} } })
  ).rejects.toThrow()

  expect(lastCreateBody?.templateID).toBe('mcp-gateway')
  expect(lastCreateBody?.mcp).toEqual({ docker: {} })
})

test('an empty mcp mapping is sent to the API as an empty object', async () => {
  // `{}` is a valid McpServer value, and it is truthy here, so it selects the
  // gateway template and starts the gateway just like a populated mapping. The
  // Python SDK agrees on both of those but drops `mcp` from the request body,
  // because there an empty dict is falsy and the body is built with `or UNSET`.
  await expect(
    Sandbox.create({ apiKey: TEST_API_KEY, mcp: {} })
  ).rejects.toThrow()

  expect(lastCreateBody?.templateID).toBe('mcp-gateway')
  expect(lastCreateBody?.mcp).toEqual({})
})

test('no mcp option keeps the default template and omits mcp', async () => {
  await Sandbox.create({ apiKey: TEST_API_KEY })

  expect(lastCreateBody?.templateID).toBe('base')
  expect(lastCreateBody?.mcp).toBeUndefined()
})
