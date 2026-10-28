import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'
import { delay, http, HttpResponse } from 'msw'

import { Sandbox } from '../../src'
import { setupMockApi } from '../mockApi'
import { TEST_API_KEY } from '../setup'

const sandboxId = 'sbx-test'

const baseConfig = {
  apiKey: TEST_API_KEY,
  domain: 'base.e2b.dev',
  requestTimeoutMs: 500,
  retries: 2,
  debug: false,
  apiHeaders: { 'X-Test': 'base' },
}

type PauseResponse = (request: Request) => Promise<Response> | Response

let pauseRequests: Request[] = []
let pauseResponse: PauseResponse = () => new HttpResponse(null, { status: 204 })

function pauseHandler(domain: string) {
  return http.post(
    `https://api.${domain}/sandboxes/:sandboxID/pause`,
    ({ request }) => {
      pauseRequests.push(request)
      return pauseResponse(request)
    }
  )
}

const server = setupMockApi(pauseHandler(baseConfig.domain))

function holdUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    const abort = () => reject(new DOMException('aborted', 'AbortError'))
    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

const retryableResponse = () =>
  HttpResponse.json(
    { code: 503, message: 'unavailable' },
    { status: 503, headers: { 'Should-Retry': 'true', 'Retry-After': '0' } }
  )

function createSandbox(overrides: Partial<typeof baseConfig> = {}) {
  return new Sandbox({
    sandboxId,
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
    trafficAccessToken: 'tok',
    ...baseConfig,
    ...overrides,
  })
}

let originalApiUrl: string | undefined
let originalSandboxUrl: string | undefined

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

describe('Sandbox API config propagation', () => {
  beforeEach(() => {
    originalApiUrl = process.env.E2B_API_URL
    originalSandboxUrl = process.env.E2B_SANDBOX_URL
    delete process.env.E2B_API_URL
  })

  afterEach(() => {
    pauseRequests = []
    pauseResponse = () => new HttpResponse(null, { status: 204 })
    server.resetHandlers()
    for (const [name, value] of [
      ['E2B_API_URL', originalApiUrl],
      ['E2B_SANDBOX_URL', originalSandboxUrl],
    ] as const) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
  })

  test('pause sends the request to the configured domain with the configured key and headers', async () => {
    await createSandbox().pause()

    expect(pauseRequests).toHaveLength(1)
    const [request] = pauseRequests
    assert.equal(
      request.url,
      `https://api.base.e2b.dev/sandboxes/${sandboxId}/pause`
    )
    assert.equal(request.headers.get('X-API-KEY'), baseConfig.apiKey)
    assert.equal(request.headers.get('X-Test'), 'base')
  })

  test('pause gives up after the configured requestTimeoutMs', async () => {
    pauseResponse = async (request) => holdUntilAborted(request.signal)

    await expect(createSandbox().pause()).rejects.toThrow()

    expect(pauseRequests).toHaveLength(1)
  }, 5_000)

  test('pause retries as many times as configured', async () => {
    pauseResponse = retryableResponse

    await expect(createSandbox().pause()).rejects.toThrow()

    expect(pauseRequests).toHaveLength(baseConfig.retries + 1)
  })

  test('per-call requestTimeoutMs overrides connectionConfig', async () => {
    pauseResponse = async () => {
      await delay(baseConfig.requestTimeoutMs * 2)
      return new HttpResponse(null, { status: 204 })
    }

    assert.isTrue(await createSandbox().pause({ requestTimeoutMs: 10_000 }))
  })

  test('per-call retries overrides connectionConfig', async () => {
    pauseResponse = retryableResponse

    await expect(createSandbox().pause({ retries: 0 })).rejects.toThrow()

    expect(pauseRequests).toHaveLength(1)
  })

  test('updateNetwork rejects when the per-call signal is aborted', async () => {
    let requestStarted!: () => void
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve
    })
    server.use(
      http.put(
        `https://api.${baseConfig.domain}/sandboxes/:sandboxID/network`,
        async ({ request }) => {
          requestStarted()
          return holdUntilAborted(request.signal)
        }
      )
    )
    // Long enough that only the per-call signal can end the request before
    // the test times out.
    const sandbox = createSandbox({ requestTimeoutMs: 60_000 })
    const controller = new AbortController()

    const promise = sandbox.updateNetwork({}, { signal: controller.signal })
    await started
    controller.abort()

    await expect(promise).rejects.toThrow()
  }, 5_000)

  test('accepts apiHeaders in static Sandbox API options', () => {
    const opts = { apiHeaders: baseConfig.apiHeaders } satisfies Parameters<
      typeof Sandbox.kill
    >[1]

    assert.equal(opts.apiHeaders['X-Test'], baseConfig.apiHeaders['X-Test'])
  })

  test('downloadUrl keeps sandbox identity in production direct URLs', async () => {
    delete process.env.E2B_SANDBOX_URL

    const sandbox = new Sandbox({
      sandboxId: 'sbx-test',
      sandboxDomain: 'e2b.app',
      envdVersion: '0.2.4',
      domain: 'e2b.app',
      debug: false,
    })

    assert.equal(
      await sandbox.downloadUrl('/hello.txt'),
      'https://49983-sbx-test.e2b.app/files?username=user&path=%2Fhello.txt'
    )
  })
})
