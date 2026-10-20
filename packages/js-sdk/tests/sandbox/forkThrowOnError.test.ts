import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import {
  RateLimitError,
  Sandbox,
  SandboxError,
  SandboxForkError,
} from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

let lastForkBody: Record<string, unknown> | undefined

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), () =>
    HttpResponse.json({
      sandboxID: 'source-sandbox',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  ),
  http.post(apiUrl('/sandboxes/:sandboxID/fork'), async ({ request }) => {
    lastForkBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json([
      {
        sandbox: {
          sandboxID: 'fork-1',
          templateID: 'base',
          envdVersion: '0.2.4',
        },
      },
      {
        error: {
          code: 429,
          message: 'rate limited',
        },
      },
    ])
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastForkBody = undefined
  server.resetHandlers()
})

test('Sandbox.fork returns the sandbox and error when throwOnError is unset', async () => {
  const results = await Sandbox.fork('source-sandbox', {
    apiKey: TEST_API_KEY,
  })

  expect(results).toHaveLength(2)
  expect(results[0]).toBeInstanceOf(Sandbox)
  expect(results[1]).toBeInstanceOf(RateLimitError)
})

test('Sandbox.fork throws with all results when throwOnError is true', async () => {
  const error = await Sandbox.fork('source-sandbox', {
    apiKey: TEST_API_KEY,
    throwOnError: true,
  }).catch((cause: unknown) => cause)

  expect(error).toBeInstanceOf(SandboxForkError)
  expect(error).toBeInstanceOf(SandboxError)

  if (!(error instanceof SandboxForkError)) {
    throw error
  }

  expect(error.results).toHaveLength(2)
  expect(error.results[0]).toBeInstanceOf(Sandbox)
  expect((error.results[0] as Sandbox).sandboxId).toBe('fork-1')
  expect(error.results[1]).toBeInstanceOf(RateLimitError)
  expect(error.message).toContain('1 of 2')
  expect(error.message).toContain('rate limited')
  expect(lastForkBody).not.toHaveProperty('throwOnError')
})

test('instance Sandbox.fork throws SandboxForkError when throwOnError is true', async () => {
  const sandbox = await Sandbox.create('base', { apiKey: TEST_API_KEY })

  await expect(sandbox.fork({ throwOnError: true })).rejects.toBeInstanceOf(
    SandboxForkError
  )
})

test('Sandbox.fork resolves only sandboxes when all forks succeed', async () => {
  server.use(
    http.post(apiUrl('/sandboxes/:sandboxID/fork'), () =>
      HttpResponse.json([
        {
          sandbox: {
            sandboxID: 'fork-1',
            templateID: 'base',
            envdVersion: '0.2.4',
          },
        },
        {
          sandbox: {
            sandboxID: 'fork-2',
            templateID: 'base',
            envdVersion: '0.2.4',
          },
        },
      ])
    )
  )

  const forks = await Sandbox.fork('source-sandbox', {
    apiKey: TEST_API_KEY,
    throwOnError: true,
  })

  expect(forks).toHaveLength(2)
  expect(forks.every((fork) => fork instanceof Sandbox)).toBe(true)
})
