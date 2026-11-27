import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../../src'
import { InvalidArgumentError } from '../../../src/errors'
import { TEST_API_KEY, apiUrl } from '../../setup'
import { setupMockApi } from '../../mockApi'

// Numbers the SDK turns into a timer, an RPC deadline or a fixed-width field
// before envd sees them. A value that cannot be one is refused; a deadline is
// sent as the `Connect-Timeout-Ms` header, which is what these tests read.

const rpcDeadlines: (string | null)[] = []
let rpcDelayMs = 0

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), () =>
    HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.6.11',
    })
  ),
  http.post('*/process.Process/:method', async ({ request }) => {
    rpcDeadlines.push(request.headers.get('connect-timeout-ms'))
    if (rpcDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, rpcDelayMs))
    }
    return HttpResponse.json(
      { code: 'not_found', message: 'answered by the test' },
      { status: 404 }
    )
  })
)

let sandbox: Sandbox

beforeAll(async () => {
  await server.listen({ onUnhandledRequest: 'error' })
  sandbox = await Sandbox.create('base', { apiKey: TEST_API_KEY })
})

afterAll(() => server.close())

afterEach(() => {
  rpcDeadlines.length = 0
  rpcDelayMs = 0
})

const untyped = (value: unknown) => value as any

describe('command timeout', () => {
  test.each([[NaN], [-1], ['1000']])(
    'commands.run refuses timeoutMs %j',
    async (timeoutMs) => {
      await expect(
        sandbox.commands.run('echo', { timeoutMs: untyped(timeoutMs) })
      ).rejects.toThrow(InvalidArgumentError)
      expect(rpcDeadlines).toEqual([])
    }
  )

  test.each([
    ['0 as no deadline', 0, null],
    ['Infinity as no deadline', Infinity, null],
    ['a fraction rounded up', 1500.5, '1501'],
    ['more than a timer holds as the longest timer', 2 ** 40, '2147483647'],
  ])('commands.run sends %s', async (_, timeoutMs, deadline) => {
    await expect(sandbox.commands.run('echo', { timeoutMs })).rejects.toThrow()
    expect(rpcDeadlines).toEqual([deadline])
  })

  test('pty.create refuses a negative timeoutMs', async () => {
    await expect(
      sandbox.pty.create({
        cols: 80,
        rows: 24,
        onData: () => {},
        timeoutMs: -1,
      })
    ).rejects.toThrow(InvalidArgumentError)
    expect(rpcDeadlines).toEqual([])
  })

  test('files.watchDir refuses a negative timeoutMs', async () => {
    await expect(
      sandbox.files.watchDir('/tmp', () => {}, { timeoutMs: -1 })
    ).rejects.toThrow(InvalidArgumentError)
    expect(rpcDeadlines).toEqual([])
  })
})

describe('request timeout', () => {
  // A unary call arms the timeout as an abort signal, a streaming call as a
  // handshake timer.
  describe.each([[NaN], [-1], ['1000']])('requestTimeoutMs %j', (value) => {
    const opts = { requestTimeoutMs: untyped(value) }

    test('is refused on a unary call', async () => {
      await expect(sandbox.commands.kill(1, opts)).rejects.toThrow(
        InvalidArgumentError
      )
      expect(rpcDeadlines).toEqual([])
    })

    test('is refused on a streaming call', async () => {
      await expect(sandbox.commands.run('echo', opts)).rejects.toThrow(
        InvalidArgumentError
      )
      expect(rpcDeadlines).toEqual([])
    })
  })

  describe.each([[Infinity], [1500.5], [2 ** 31], [2 ** 40]])(
    'requestTimeoutMs %j',
    (requestTimeoutMs) => {
      const opts = { requestTimeoutMs }

      test('lets a slow answer to a unary call through', async () => {
        rpcDelayMs = 50

        // `kill` reads "not found" as the process being gone already.
        await expect(sandbox.commands.kill(1, opts)).resolves.toBe(false)
      })

      test('lets a slow answer to a streaming call through', async () => {
        rpcDelayMs = 50

        // The answer is the mock's 404, not a timeout.
        await expect(sandbox.commands.run('echo', opts)).rejects.toThrow(
          'HTTP 404'
        )
      })
    }
  )
})

describe('fixed-width integers', () => {
  describe.each(['cols', 'rows'] as const)('a PTY with %s of', (field) => {
    const size = (side: unknown) => ({ cols: 80, rows: 24, [field]: side })

    test.each([[0], [-1], [80.5], [65536], [NaN], ['80']])(
      '%j is refused by pty.create',
      async (side) => {
        await expect(
          sandbox.pty.create({ ...untyped(size(side)), onData: () => {} })
        ).rejects.toThrow(InvalidArgumentError)
        expect(rpcDeadlines).toEqual([])
      }
    )

    test.each([[0], [-1], [80.5], [65536], [NaN], ['80']])(
      '%j is refused by pty.resize',
      async (side) => {
        await expect(
          sandbox.pty.resize(1, untyped(size(side)))
        ).rejects.toThrow(InvalidArgumentError)
        expect(rpcDeadlines).toEqual([])
      }
    )
  })

  describe.each<[string, (pid: any) => Promise<unknown>]>([
    ['commands.kill', (pid) => sandbox.commands.kill(pid)],
    ['commands.sendStdin', (pid) => sandbox.commands.sendStdin(pid, 'data')],
    ['commands.connect', (pid) => sandbox.commands.connect(pid)],
    ['pty.kill', (pid) => sandbox.pty.kill(pid)],
    ['pty.sendInput', (pid) => sandbox.pty.sendInput(pid, new Uint8Array())],
    ['pty.resize', (pid) => sandbox.pty.resize(pid, { cols: 80, rows: 24 })],
  ])('%s', (_, call) => {
    test.each([[-1], [1.5], [NaN], ['1'], [2 ** 32]])(
      'refuses a pid of %j',
      async (pid) => {
        await expect(call(pid)).rejects.toThrow(InvalidArgumentError)
        expect(rpcDeadlines).toEqual([])
      }
    )
  })
})
