import createClient from 'openapi-fetch'
import { Response as UndiciResponse } from 'undici'
import { assert, describe, test } from 'vitest'
import { createApiLogger, createRpcLogger } from '../src/logs'

const req = { url: 'http://localhost:49983/process.Process/Start' } as any

describe('createRpcLogger', () => {
  test('logs unary responses containing bigint fields without throwing', async () => {
    const logs: any[][] = []
    const interceptor = createRpcLogger({ info: (...args) => logs.push(args) })

    const res = { stream: false, message: { size: 42n, name: 'file' } } as any
    const result = await interceptor(async () => res)(req)

    assert.equal(result, res)
    assert.deepEqual(logs[1], ['Response:', { size: '42', name: 'file' }])
  })

  test('logs streamed messages containing bigint fields without throwing', async () => {
    const logs: any[][] = []
    const interceptor = createRpcLogger({ debug: (...args) => logs.push(args) })

    async function* stream() {
      yield { offset: 9007199254740993n }
    }
    const res = { stream: true, message: stream() } as any
    const result = (await interceptor(async () => res)(req)) as any

    const received = []
    for await (const m of result.message) {
      received.push(m)
    }

    assert.deepEqual(received, [{ offset: 9007199254740993n }])
    assert.deepEqual(logs[0], [
      'Response stream:',
      { offset: '9007199254740993' },
    ])
  })
})

describe('createApiLogger', () => {
  // On Node the API client fetches through undici, whose Response is not the
  // global one; openapi-fetch rejects any onResponse result that is not an
  // instance of the global Response.
  test('logs responses that are not instances of the global Response', async () => {
    assert.notStrictEqual(UndiciResponse, globalThis.Response)
    const logs: any[][] = []
    const client = createClient<any>({
      baseUrl: 'http://localhost',
      fetch: async () =>
        new UndiciResponse('{"message":"boom"}', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'content-type': 'application/json' },
        }) as unknown as Response,
    })
    client.use(
      createApiLogger({
        info: (...args) => logs.push(['info', ...args]),
        error: (...args) => logs.push(['error', ...args]),
      })
    )

    const res = await client.GET('/sandboxes' as any)

    assert.equal(res.response.status, 500)
    assert.deepEqual(res.error, { message: 'boom' })
    assert.deepEqual(logs, [
      ['info', 'Request GET http://localhost/sandboxes'],
      ['error', 'Response:', 500, 'Internal Server Error'],
    ])
  })
})
