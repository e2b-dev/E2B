import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import {
  Sandbox,
  SandboxError,
  SandboxNotFoundError,
  TemplateError,
} from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

function errorResponse(sandboxId: unknown) {
  switch (sandboxId) {
    case 'missing':
      return HttpResponse.json(
        { code: 404, message: "Sandbox doesn't exist" },
        { status: 404 }
      )
    case 'empty-404':
      return new HttpResponse(null, { status: 404, statusText: 'Not Found' })
    case 'wrong-route':
      return HttpResponse.json(
        {
          code: 404,
          message: 'validation error: no matching operation was found',
        },
        { status: 404 }
      )
    case 'http-500-with-404-code':
      return HttpResponse.json(
        { code: 404, message: 'downstream sandbox not found' },
        { status: 500 }
      )
    default:
      return HttpResponse.json(
        { code: 500, message: 'Unexpected sandboxId in test' },
        { status: 500 }
      )
  }
}

const server = setupMockApi(
  http.delete(apiUrl('/sandboxes/:sandboxID'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.get(apiUrl('/sandboxes/:sandboxID'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.get(apiUrl('/sandboxes/:sandboxID/metrics'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.post(apiUrl('/sandboxes/:sandboxID/timeout'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.put(apiUrl('/sandboxes/:sandboxID/network'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.post(apiUrl('/sandboxes/:sandboxID/pause'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.post(apiUrl('/sandboxes/:sandboxID/snapshots'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.delete(apiUrl('/templates/:templateID'), ({ params }) =>
    errorResponse(params.templateID)
  ),
  http.post(apiUrl('/sandboxes/:sandboxID/fork'), ({ params }) =>
    errorResponse(params.sandboxID)
  ),
  http.post(apiUrl('/v2/sandboxes/:sandboxID/connect'), ({ params }) =>
    errorResponse(params.sandboxID)
  )
)

const opts = { apiKey: TEST_API_KEY }

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

const throwingMethods: Array<
  [string, (sandboxId: string) => Promise<unknown>]
> = [
  ['getInfo', (id) => Sandbox.getInfo(id, opts)],
  ['getMetrics', (id) => Sandbox.getMetrics(id, opts)],
  ['setTimeout', (id) => Sandbox.setTimeout(id, 60_000, opts)],
  ['updateNetwork', (id) => Sandbox.updateNetwork(id, { allowOut: [] }, opts)],
  ['pause', (id) => Sandbox.pause(id, opts)],
  ['betaPause', (id) => Sandbox.betaPause(id, opts)],
  ['createSnapshot', (id) => Sandbox.createSnapshot(id, opts)],
  ['fork', (id) => Sandbox.fork(id, opts)],
  ['connect', (id) => Sandbox.connect(id, opts)],
]

describe.each(throwingMethods)('Sandbox.%s', (_, call) => {
  test.each(['missing', 'empty-404'])(
    'throws SandboxNotFoundError for %s',
    async (sandboxId) => {
      const error = await call(sandboxId).catch((err) => err)

      expect(error).toBeInstanceOf(SandboxNotFoundError)
    }
  )

  test.each([
    [
      'wrong-route',
      404,
      '404: validation error: no matching operation was found',
    ],
    ['http-500-with-404-code', 500, '500: downstream sandbox not found'],
  ])(
    'throws generic SandboxError for %s',
    async (sandboxId, statusCode, message) => {
      const error = await call(sandboxId).catch((err) => err)

      expect(error).toBeInstanceOf(SandboxError)
      expect(error).not.toBeInstanceOf(SandboxNotFoundError)
      expect(error.statusCode).toBe(statusCode)
      expect(error.message).toBe(message)
    }
  )
})

describe('Sandbox.kill', () => {
  test.each(['missing', 'empty-404'])(
    'returns false for %s',
    async (sandboxId) => {
      await expect(Sandbox.kill(sandboxId, opts)).resolves.toBe(false)
    }
  )

  test.each([
    [
      'wrong-route',
      404,
      '404: validation error: no matching operation was found',
    ],
    ['http-500-with-404-code', 500, '500: downstream sandbox not found'],
  ])(
    'throws generic SandboxError for %s',
    async (sandboxId, statusCode, message) => {
      const error = await Sandbox.kill(sandboxId, opts).catch((err) => err)

      expect(error).toBeInstanceOf(SandboxError)
      expect(error).not.toBeInstanceOf(SandboxNotFoundError)
      expect(error.statusCode).toBe(statusCode)
      expect(error.message).toBe(message)
    }
  )
})

describe('Sandbox.deleteSnapshot', () => {
  test.each(['missing', 'empty-404'])(
    'returns false for %s',
    async (snapshotId) => {
      await expect(Sandbox.deleteSnapshot(snapshotId, opts)).resolves.toBe(
        false
      )
    }
  )

  test.each([
    [
      'wrong-route',
      404,
      '404: validation error: no matching operation was found',
    ],
    ['http-500-with-404-code', 500, '500: downstream sandbox not found'],
  ])('throws TemplateError for %s', async (snapshotId, statusCode, message) => {
    const error = await Sandbox.deleteSnapshot(snapshotId, opts).catch(
      (err) => err
    )

    expect(error).toBeInstanceOf(TemplateError)
    expect(error.statusCode).toBe(statusCode)
    expect(error.message).toBe(message)
  })
})
