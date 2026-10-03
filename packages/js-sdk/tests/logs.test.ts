import { assert, describe, test } from 'vitest'
import { createRpcLogger } from '../src/logs'

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
