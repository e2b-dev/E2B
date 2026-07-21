import { constants, createSecureServer } from 'node:http2'
import type { ServerHttp2Session } from 'node:http2'
import { once } from 'node:events'

import pem from '@metcoder95/https-pem'
import * as undici8 from 'undici8'
import { expect, test } from 'vitest'

import { loadUndici } from '../src/undici'

test('lets an accepted POST finish after a graceful HTTP/2 GOAWAY', async () => {
  const server = createSecureServer(
    await pem.generate({ opts: { keySize: 2048 } })
  )
  let requests = 0
  let session: ServerHttp2Session | undefined

  server.once('session', (value) => {
    session = value
  })

  server.on('stream', (stream) => {
    requests++
    stream.resume()
    stream.once('end', () => {
      stream.respond({ ':status': 201 })
      stream.session.goaway(constants.NGHTTP2_NO_ERROR, stream.id)
      setImmediate(() => stream.end('created'))
    })
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('HTTP/2 test server did not bind to a TCP port')
  }

  const undici = await loadUndici(async (packageName) => {
    expect(packageName).toBe('undici8')
    return undici8
  })
  expect(undici?.retryGracefulGoAway).toBe(false)
  if (!undici) {
    throw new Error('Undici was not available')
  }

  const Agent = undici.Agent as unknown as new (options: {
    allowH2: true
    connections: number
    connect: { rejectUnauthorized: false }
  }) => { destroy(): Promise<void> }
  const undiciFetch = undici.fetch as (
    input: string,
    init: RequestInit & { dispatcher: unknown }
  ) => Promise<Response>
  const dispatcher = new Agent({
    allowH2: true,
    connections: 1,
    connect: { rejectUnauthorized: false },
  })

  try {
    const response = await undiciFetch(
      `https://127.0.0.1:${address.port}/sandboxes`,
      {
        method: 'POST',
        body: JSON.stringify({ templateID: 'base' }),
        headers: { 'content-type': 'application/json' },
        dispatcher,
      }
    )

    expect(response.status).toBe(201)
    expect(await response.text()).toBe('created')
    expect(requests).toBe(1)
  } finally {
    await dispatcher.destroy()
    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    session?.destroy()
    await closed
  }
})
