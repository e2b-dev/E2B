import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../src'
import { InvalidArgumentError } from '../../src/errors'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

// Arguments the API never sees as they were given: the SDK turns them into a
// URL or a request field first. Each must be refused before a request is sent.

const requests: string[] = []
let lastCreateBody: Record<string, any> | undefined

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, any>
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  })
)

beforeAll(async () => {
  await server.listen({ onUnhandledRequest: 'error' })
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`)
  })
})

afterAll(() => server.close())

afterEach(() => {
  requests.length = 0
  lastCreateBody = undefined
  server.resetHandlers()
})

const apiOpts = { apiKey: TEST_API_KEY }
const untyped = (value: unknown) => value as any

describe('sandbox ID in the request path', () => {
  test.each(['', '.', '..'])('Sandbox.kill refuses %j', async (sandboxId) => {
    await expect(Sandbox.kill(sandboxId, apiOpts)).rejects.toThrow(
      InvalidArgumentError
    )
    expect(requests).toEqual([])
  })

  test('Sandbox.kill refuses a missing ID', async () => {
    await expect(Sandbox.kill(untyped(undefined), apiOpts)).rejects.toThrow(
      InvalidArgumentError
    )
    expect(requests).toEqual([])
  })

  test.each<[string, () => Promise<unknown>]>([
    ['getInfo', () => Sandbox.getInfo('..', apiOpts)],
    ['setTimeout', () => Sandbox.setTimeout('..', 1000, apiOpts)],
    ['pause', () => Sandbox.pause('..', apiOpts)],
    ['connect', () => Sandbox.connect('..', apiOpts)],
    ['getMetrics', () => Sandbox.getMetrics('..', apiOpts)],
    ['deleteSnapshot', () => Sandbox.deleteSnapshot('..', apiOpts)],
  ])('Sandbox.%s refuses a dot segment', async (_, call) => {
    await expect(call()).rejects.toThrow(InvalidArgumentError)
    expect(requests).toEqual([])
  })

  test('Sandbox.kill keeps a slash inside one path segment', async () => {
    server.use(
      http.delete(
        apiUrl('/sandboxes/:sandboxID'),
        () => new HttpResponse(null, { status: 204 })
      )
    )

    await Sandbox.kill('../templates/tpl123', apiOpts)

    expect(requests).toEqual(['DELETE /sandboxes/..%2Ftemplates%2Ftpl123'])
  })
})

describe('network selectors', () => {
  test('a denyOut callback that returns nothing is refused', async () => {
    await expect(
      Sandbox.create('base', {
        ...apiOpts,
        network: {
          // A block body without `return`.
          denyOut: untyped(({ allTraffic }: { allTraffic: string }) => {
            void [allTraffic]
          }),
        },
      })
    ).rejects.toThrow(InvalidArgumentError)
    expect(requests).toEqual([])
  })

  test.each(['allowOut', 'denyOut', 'dnsServers'])(
    '%s given as a string is refused',
    async (field) => {
      await expect(
        Sandbox.create('base', {
          ...apiOpts,
          network: { [field]: untyped('example.com') },
        })
      ).rejects.toThrow(InvalidArgumentError)
      expect(requests).toEqual([])
    }
  )

  test('a selector callback still resolves to the list it returns', async () => {
    await Sandbox.create('base', {
      ...apiOpts,
      network: {
        denyOut: ({ allTraffic }) => [allTraffic],
        allowOut: ['1.1.1.1'],
      },
    })

    expect(lastCreateBody?.network).toEqual({
      denyOut: ['0.0.0.0/0'],
      allowOut: ['1.1.1.1'],
    })
  })
})

describe('string maps', () => {
  test.each(['envs', 'metadata'])(
    'an undefined %s value is refused',
    async (field) => {
      await expect(
        Sandbox.create('base', {
          ...apiOpts,
          [field]: { KEPT: 'value', MISSING: untyped(undefined) },
        })
      ).rejects.toThrow(/MISSING/)
      expect(requests).toEqual([])
    }
  )

  const headers = { Authorization: undefined }

  test.each<[string, unknown]>([
    ['an object', { headers }],
    ['a callback', () => ({ headers })],
  ])(
    'an undefined header value in a transform given as %s is refused',
    async (_, transform) => {
      await expect(
        Sandbox.create('base', {
          ...apiOpts,
          network: {
            rules: { 'api.example.com': [{ transform: untyped(transform) }] },
          },
        })
      ).rejects.toThrow(/Authorization/)
      expect(requests).toEqual([])
    }
  )

  test('an undefined metadata filter value is refused', async () => {
    const paginator = Sandbox.list({
      ...apiOpts,
      query: { metadata: { team: untyped(undefined) } },
    })

    await expect(paginator.nextItems()).rejects.toThrow(InvalidArgumentError)
    expect(requests).toEqual([])
  })
})
