import { afterEach, assert, describe, test } from 'vitest'
import { createApiLogger, createRpcLogger } from '../src/logs'

const req = { url: 'http://localhost:49983/process.Process/Start' } as any
const originalRequestSource = process.env.E2B_USER_AGENT_SOURCE

afterEach(() => {
  if (originalRequestSource === undefined) {
    delete process.env.E2B_USER_AGENT_SOURCE
  } else {
    process.env.E2B_USER_AGENT_SOURCE = originalRequestSource
  }
})

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
  test('observes requests without replacing them', async () => {
    const logs: any[][] = []
    const middleware = createApiLogger({
      info: (...args) => logs.push(args),
    })
    const request = new Request('https://api.e2b.app/sandboxes')

    const result = await middleware.onRequest?.({ request } as any)

    assert.isUndefined(result)
    assert.deepEqual(logs, [['Request GET https://api.e2b.app/sandboxes']])
  })

  test('logs the E2B trace ID for CI failed responses', async () => {
    const logs: any[][] = []
    const middleware = createApiLogger(
      {
        error: (...args) => logs.push(args),
      },
      true
    )
    const response = new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'X-E2B-Trace-ID': 'trace-123' },
    })

    const result = await middleware.onResponse?.({ response } as any)

    assert.isUndefined(result)
    assert.deepEqual(logs, [
      ['Response:', 500, 'Internal Server Error', 'trace_id=trace-123'],
    ])
  })

  test('does not log the E2B trace ID outside CI', async () => {
    const logs: any[][] = []
    const middleware = createApiLogger(
      {
        error: (...args) => logs.push(args),
      },
      false
    )
    const response = new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'X-E2B-Trace-ID': 'trace-123' },
    })

    const result = await middleware.onResponse?.({ response } as any)

    assert.isUndefined(result)
    assert.deepEqual(logs, [['Response:', 500, 'Internal Server Error']])
  })
})
