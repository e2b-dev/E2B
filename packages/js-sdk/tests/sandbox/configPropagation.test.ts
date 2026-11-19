import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  beforeEach,
  describe,
  test,
  vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../src'
import { setupMockApi } from '../mockApi'
import { SandboxApi } from '../../src/sandbox/sandboxApi'
import { TEST_API_KEY } from '../setup'

let originalSandboxUrl: string | undefined

const baseConfig = {
  apiKey: TEST_API_KEY,
  domain: 'base.e2b.dev',
  requestTimeoutMs: 1111,
  retries: 2,
  debug: false,
  apiHeaders: { 'X-Test': 'base' },
}

function createSandbox(opts?: { apiUrl?: string }) {
  return new Sandbox({
    sandboxId: 'sbx-test',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
    trafficAccessToken: 'tok',
    ...baseConfig,
    ...opts,
  })
}

const pauseRequestUrls: string[] = []
const mockApi = setupMockApi(
  http.post('*/sandboxes/:sandboxID/pause', ({ request }) => {
    pauseRequestUrls.push(request.url)
    return new HttpResponse(null, { status: 204 })
  })
)

describe('Sandbox API host', () => {
  beforeAll(() => mockApi.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => mockApi.close())
  afterEach(() => {
    pauseRequestUrls.length = 0
  })

  test('uses the bound domain', async () => {
    await createSandbox().pause()

    assert.deepEqual(pauseRequestUrls, [
      'https://api.base.e2b.dev/sandboxes/sbx-test/pause',
    ])
  })

  test('uses a per-call domain', async () => {
    await createSandbox().pause({ domain: 'override.e2b.dev' })

    assert.deepEqual(pauseRequestUrls, [
      'https://api.override.e2b.dev/sandboxes/sbx-test/pause',
    ])
  })

  test('uses a per-call domain when built from a resolved config', async () => {
    // Sandbox.create and Sandbox.connect pass the resolved config, whose
    // apiUrl is derived from the bound domain.
    await createSandbox({ apiUrl: 'https://api.base.e2b.dev' }).pause({
      domain: 'override.e2b.dev',
    })

    assert.deepEqual(pauseRequestUrls, [
      'https://api.override.e2b.dev/sandboxes/sbx-test/pause',
    ])
  })

  test('keeps an explicit apiUrl over a per-call domain', async () => {
    await createSandbox({ apiUrl: 'https://api.custom.e2b.dev' }).pause({
      domain: 'override.e2b.dev',
    })

    assert.deepEqual(pauseRequestUrls, [
      'https://api.custom.e2b.dev/sandboxes/sbx-test/pause',
    ])
  })
})

describe('Sandbox API config propagation', () => {
  beforeEach(() => {
    originalSandboxUrl = process.env.E2B_SANDBOX_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalSandboxUrl === undefined) {
      delete process.env.E2B_SANDBOX_URL
    } else {
      process.env.E2B_SANDBOX_URL = originalSandboxUrl
    }
  })

  test('passes connectionConfig to public API methods when called without overrides', async () => {
    const pauseSpy = vi.spyOn(SandboxApi, 'pause').mockResolvedValue(true)
    const sandbox = createSandbox()

    await sandbox.pause()

    const opts = pauseSpy.mock.calls[0][1]
    assert.equal(opts?.apiKey, baseConfig.apiKey)
    assert.equal(opts?.domain, baseConfig.domain)
    assert.equal(opts?.requestTimeoutMs, baseConfig.requestTimeoutMs)
    assert.equal(opts?.retries, baseConfig.retries)
    assert.equal(opts?.debug, baseConfig.debug)
    assert.equal(opts?.headers?.['X-Test'], baseConfig.apiHeaders['X-Test'])
  })

  test('accepts apiHeaders in static Sandbox API options', () => {
    const opts = { apiHeaders: baseConfig.apiHeaders } satisfies Parameters<
      typeof Sandbox.kill
    >[1]

    assert.equal(opts.apiHeaders['X-Test'], baseConfig.apiHeaders['X-Test'])
  })

  test('lets public method call overrides win over connectionConfig', async () => {
    const pauseSpy = vi.spyOn(SandboxApi, 'pause').mockResolvedValue(true)
    const sandbox = createSandbox()

    await sandbox.pause({
      domain: 'override.e2b.dev',
      requestTimeoutMs: 9999,
      retries: 0,
    })

    const opts = pauseSpy.mock.calls[0][1]
    assert.equal(opts?.apiKey, baseConfig.apiKey)
    assert.equal(opts?.domain, 'override.e2b.dev')
    assert.equal(opts?.requestTimeoutMs, 9999)
    assert.equal(opts?.retries, 0)
    assert.equal(opts?.debug, baseConfig.debug)
  })

  test('updateNetwork forwards per-call signal', async () => {
    const updateNetworkSpy = vi
      .spyOn(SandboxApi, 'updateNetwork')
      .mockResolvedValue()
    const sandbox = createSandbox()
    const controller = new AbortController()

    await sandbox.updateNetwork({}, { signal: controller.signal })

    const opts = updateNetworkSpy.mock.calls[0][2]
    assert.equal(opts?.signal, controller.signal)
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
