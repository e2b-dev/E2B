import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ConnectionConfig } from '../src/connectionConfig'
import {
  ALT_USED_HEADER,
  EnvdPlaneRouting,
  PLANE_TTL_MS,
  currentPlane,
  learnPlane,
  planeKey,
  resetPlanes,
  withApiPlaneRouting,
} from '../src/planeRouting'

const API_KEY = 'e2b_test'

function config(opts: ConstructorParameters<typeof ConnectionConfig>[0] = {}) {
  return new ConnectionConfig({ apiKey: API_KEY, domain: 'e2b.app', ...opts })
}

function reply(status = 200, altUsed?: string) {
  return new Response('{}', {
    status,
    headers: altUsed ? { [ALT_USED_HEADER]: altUsed } : {},
  })
}

function connectionRefused() {
  return new TypeError('fetch failed', {
    cause: Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    }),
  })
}

function requestURL(call: unknown[]): string {
  const [input] = call
  return input instanceof Request ? input.url : String(input)
}

beforeEach(() => {
  resetPlanes()
  delete process.env.E2B_API_URL
  delete process.env.E2B_SANDBOX_URL
  delete process.env.E2B_DEBUG
})

afterEach(() => {
  vi.useRealTimers()
})

describe('planeKey', () => {
  test('routes a supported domain with an API key', () => {
    expect(planeKey(config())).toBeDefined()
    expect(planeKey(config({ domain: 'e2b.dev' }))).toBeDefined()
  })

  test.each([
    ['without an API key', { apiKey: '' }],
    ['in debug mode', { debug: true }],
    ['on an unsupported domain', { domain: 'example.com' }],
    ['with an overridden API URL', { apiUrl: 'https://api.example.com' }],
    ['with an overridden sandbox URL', { sandboxUrl: 'https://sbx.local' }],
  ])('does not route %s', (_, opts) => {
    delete process.env.E2B_API_KEY
    expect(planeKey(config(opts))).toBeUndefined()
  })
})

describe('learnPlane', () => {
  const key = 'e2b.app\ne2b_test'

  test('learns a supported plane from a supported API host', () => {
    learnPlane(
      key,
      'https://api.e2b.app/sandboxes',
      reply(200, 'api.e2b-foxtrot.dev')
    )
    expect(currentPlane(key)).toBe('e2b-foxtrot.dev')
  })

  test('follows a later response that names another plane', () => {
    learnPlane(key, 'https://api.e2b.app/a', reply(200, 'api.e2b-foxtrot.dev'))
    learnPlane(
      key,
      'https://api.e2b.app/b',
      reply(200, 'api.foxtrot-3.e2b.dev')
    )
    expect(currentPlane(key)).toBe('foxtrot-3.e2b.dev')
  })

  test.each([
    'https://api.example.com/sandboxes',
    'https://sandbox.e2b.app/files',
    'https://49983-sbx.e2b.app/files',
  ])('ignores a response from %s', (url) => {
    learnPlane(key, url, reply(200, 'api.e2b-foxtrot.dev'))
    expect(currentPlane(key)).toBeUndefined()
  })

  test.each([
    'api.example.com',
    'api.ctp-staging-1-us-west-2-aws.e2b.dev',
    'e2b-foxtrot.dev',
    'sandbox.e2b-foxtrot.dev',
    'api.e2b-foxtrot.dev:8443',
    'https://api.e2b-foxtrot.dev',
    '',
  ])('ignores the hint %j', (hint) => {
    learnPlane(key, 'https://api.e2b.app/sandboxes', reply(200, hint))
    expect(currentPlane(key)).toBeUndefined()
  })

  test('expires a plane after the TTL', () => {
    learnPlane(
      key,
      'https://api.e2b.app/a',
      reply(200, 'api.e2b-foxtrot.dev'),
      0
    )
    expect(currentPlane(key, PLANE_TTL_MS - 1)).toBe('e2b-foxtrot.dev')
    expect(currentPlane(key, PLANE_TTL_MS)).toBeUndefined()
  })
})

describe('withApiPlaneRouting', () => {
  test('sends later requests to the plane the proxy named', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply(200, 'api.e2b-foxtrot.dev'))
      .mockResolvedValueOnce(reply(200))
    const routed = withApiPlaneRouting(fetchImpl, config())

    await routed(new Request('https://api.e2b.app/sandboxes'))
    await routed(
      new Request('https://api.e2b.app/sandboxes', {
        method: 'POST',
        body: '{"templateID":"base"}',
      })
    )

    expect(requestURL(fetchImpl.mock.calls[0])).toBe(
      'https://api.e2b.app/sandboxes'
    )
    const second = fetchImpl.mock.calls[1][0] as Request
    expect(second.url).toBe('https://api.e2b-foxtrot.dev/sandboxes')
    expect(second.method).toBe('POST')
    expect(await second.text()).toBe('{"templateID":"base"}')
  })

  test.each([
    ['is refused with 401', () => Promise.resolve(reply(401))],
    ['cannot be reached', () => Promise.reject(connectionRefused())],
  ])(
    'sends the request through the proxy again when the plane %s',
    async (_, planeAnswer) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(reply(200, 'api.e2b-foxtrot.dev'))
        .mockImplementationOnce(planeAnswer)
        .mockResolvedValueOnce(reply(200, 'api.foxtrot-2.e2b.dev'))
      const cfg = config()
      const routed = withApiPlaneRouting(fetchImpl, cfg)

      await routed(new Request('https://api.e2b.app/sandboxes'))
      const response = await routed(
        new Request('https://api.e2b.app/sandboxes', {
          method: 'POST',
          body: '{}',
        })
      )

      expect(response.status).toBe(200)
      expect(fetchImpl.mock.calls.map(requestURL)).toEqual([
        'https://api.e2b.app/sandboxes',
        'https://api.e2b-foxtrot.dev/sandboxes',
        'https://api.e2b.app/sandboxes',
      ])
      expect(await (fetchImpl.mock.calls[2][0] as Request).text()).toBe('{}')
      expect(currentPlane(planeKey(cfg)!)).toBe('foxtrot-2.e2b.dev')
    }
  )

  test('does not send a request again when it failed after connecting', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply(200, 'api.e2b-foxtrot.dev'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
    const routed = withApiPlaneRouting(fetchImpl, config())

    await routed(new Request('https://api.e2b.app/sandboxes'))
    await expect(
      routed(
        new Request('https://api.e2b.app/sandboxes', {
          method: 'POST',
          body: '{}',
        })
      )
    ).rejects.toThrow('fetch failed')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  test('goes through the proxy again once the plane expires', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(reply(200, 'api.e2b-foxtrot.dev'))
    const routed = withApiPlaneRouting(fetchImpl, config())

    await routed(new Request('https://api.e2b.app/a'))
    vi.advanceTimersByTime(PLANE_TTL_MS)
    await routed(new Request('https://api.e2b.app/b'))

    expect(fetchImpl.mock.calls.map(requestURL)).toEqual([
      'https://api.e2b.app/a',
      'https://api.e2b.app/b',
    ])
  })

  test('does not route a config it must not', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    expect(
      withApiPlaneRouting(fetchImpl, config({ domain: 'example.com' }))
    ).toBe(fetchImpl)
  })
})

describe('EnvdPlaneRouting', () => {
  const key = 'e2b.app\ne2b_test'

  beforeEach(() => {
    learnPlane(
      key,
      'https://api.e2b.app/sandboxes',
      reply(200, 'api.e2b-foxtrot.dev')
    )
  })

  test.each([
    [
      'https://sandbox.e2b.app/process.Process/List',
      'https://sandbox.e2b-foxtrot.dev/process.Process/List',
    ],
    [
      'https://49983-sbx.e2b.app/files?path=a',
      'https://49983-sbx.e2b-foxtrot.dev/files?path=a',
    ],
  ])('sends %s to the plane', async (from, to) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply())
    const routed = new EnvdPlaneRouting(key, 'e2b.app').wrap(fetchImpl)

    await routed(from, { method: 'POST', body: new Uint8Array([1]) })

    expect(requestURL(fetchImpl.mock.calls[0])).toBe(to)
  })

  test('leaves hosts outside the configured domain alone', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply())
    const routed = new EnvdPlaneRouting(key, 'e2b.app').wrap(fetchImpl)

    await routed('https://sandbox.example.com/files')

    expect(requestURL(fetchImpl.mock.calls[0])).toBe(
      'https://sandbox.example.com/files'
    )
  })

  test('stays on the configured host after the plane answers 502', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply(502))
      .mockResolvedValue(reply())
    const routed = new EnvdPlaneRouting(key, 'e2b.app').wrap(fetchImpl)

    const response = await routed('https://sandbox.e2b.app/a', {
      method: 'POST',
      body: '{}',
    })
    await routed('https://sandbox.e2b.app/b')

    expect(response.status).toBe(200)
    expect(fetchImpl.mock.calls.map(requestURL)).toEqual([
      'https://sandbox.e2b-foxtrot.dev/a',
      'https://sandbox.e2b.app/a',
      'https://sandbox.e2b.app/b',
    ])
  })

  test('falls back when the plane cannot be reached', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(connectionRefused())
      .mockResolvedValue(reply())
    const routed = new EnvdPlaneRouting(key, 'e2b.app').wrap(fetchImpl)

    await routed('https://sandbox.e2b.app/a')

    expect(fetchImpl.mock.calls.map(requestURL)).toEqual([
      'https://sandbox.e2b-foxtrot.dev/a',
      'https://sandbox.e2b.app/a',
    ])
  })

  test('keeps routing when the configured host answers 502 too', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply(502))
    const routed = new EnvdPlaneRouting(key, 'e2b.app').wrap(fetchImpl)

    await routed('https://sandbox.e2b.app/a')
    await routed('https://sandbox.e2b.app/b')

    expect(requestURL(fetchImpl.mock.calls[2])).toBe(
      'https://sandbox.e2b-foxtrot.dev/b'
    )
  })

  test('sends a streaming body once, to the plane', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply(502))
    const routed = new EnvdPlaneRouting(key, 'e2b.app').wrap(fetchImpl)

    const response = await routed(
      new Request('https://sandbox.e2b.app/files', {
        method: 'POST',
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1]))
            controller.close()
          },
        }),
        duplex: 'half',
      } as RequestInit)
    )

    expect(response.status).toBe(502)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(requestURL(fetchImpl.mock.calls[0])).toBe(
      'https://sandbox.e2b-foxtrot.dev/files'
    )
  })

  test('does nothing without a key', () => {
    const fetchImpl = vi.fn<typeof fetch>()
    expect(new EnvdPlaneRouting(undefined, 'e2b.app').wrap(fetchImpl)).toBe(
      fetchImpl
    )
  })
})
