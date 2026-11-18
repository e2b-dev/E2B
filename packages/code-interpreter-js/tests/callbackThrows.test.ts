import { once } from 'node:events'
import { createServer, IncomingMessage } from 'node:http'
import { AddressInfo } from 'node:net'

import { expect, test } from 'vitest'

import { Sandbox } from '../src'

// Constructing a sandbox instance makes no network requests.
function createSandbox(opts: object = {}) {
  const SandboxClass = Sandbox as unknown as new (opts: object) => Sandbox
  return new SandboxClass({
    sandboxId: 'test-sandbox-id',
    envdVersion: '0.2.0',
    ...opts,
  })
}

test('runCode closes the /execute connection when onStdout throws', async () => {
  // A local server that behaves like a never-ending execution: one stdout
  // line, then a keepalive line every 100 ms, like the Jupyter server does.
  let execReq: IncomingMessage | undefined
  let reqClosed = false
  const server = createServer((req, res) => {
    execReq = req
    res.on('close', () => {
      reqClosed = true
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.write(
      JSON.stringify({ type: 'stdout', text: 'tick\n', timestamp: 1 }) + '\n'
    )
    const keepalive = setInterval(() => {
      res.write('{"type": "keepalive"}\n')
    }, 100)
    res.on('close', () => clearInterval(keepalive))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo

  try {
    const sandbox = createSandbox({ sandboxUrl: `http://127.0.0.1:${port}` })

    await expect(
      sandbox.runCode('while True: print("tick")', {
        timeoutMs: 1_000,
        onStdout: () => {
          throw new Error('stop')
        },
      })
    ).rejects.toThrow('stop')
    expect(execReq).toBeDefined()

    // Wait well past timeoutMs. If the SDK had released the response, the
    // server would have seen the client go away by now.
    await new Promise((r) => setTimeout(r, 2_000))
    expect(reqClosed).toBe(true)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('runCode cancels the response body when a callback throws', async () => {
  let cancelled = false
  let signal: AbortSignal | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    signal = init?.signal ?? undefined
    const encoder = new TextEncoder()
    let sent = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: 'stdout', text: 'tick\n', timestamp: 1 }) +
                '\n'
            )
          )
        }
        // Never closes: the execution is still running on the server.
      },
      cancel() {
        cancelled = true
      },
    })
    return new Response(body, { status: 200 })
  }) as typeof fetch

  try {
    const sandbox = createSandbox()
    await expect(
      sandbox.runCode('while True: print("tick")', {
        onStdout: () => {
          throw new Error('stop')
        },
      })
    ).rejects.toThrow('stop')

    expect(cancelled || signal?.aborted).toBe(true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
