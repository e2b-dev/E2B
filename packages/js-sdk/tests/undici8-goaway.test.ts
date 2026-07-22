import { constants, createSecureServer } from 'node:http2'
import type { ServerHttp2Session } from 'node:http2'
import { once } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import pem from '@metcoder95/https-pem'
import { expect, test } from 'vitest'

import { getUndiciPackageCandidates, loadUndici } from '../src/undici'

const supportsUndici8 = getUndiciPackageCandidates(
  process.versions.node
).includes('undici8')
const execFileAsync = promisify(execFile)

test.skipIf(!supportsUndici8)('loads Undici 8 by default', async () => {
  const source = new URL('../src/undici.ts', import.meta.url).href
  const script = `
    const actual = await (await import(${JSON.stringify(source)})).loadUndici()
    const expected = await import('undici8')
    if (actual.Agent !== expected.Agent || actual.fetch !== expected.fetch) process.exit(1)
  `

  await execFileAsync(process.execPath, ['--input-type=module', '-e', script])
})

test.skipIf(!supportsUndici8)(
  'lets an accepted POST finish after a graceful HTTP/2 GOAWAY',
  async () => {
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

    const packageName = 'undici8'
    const undici8 = await import(/* @vite-ignore */ packageName)
    const undici = await loadUndici(async (candidate) => {
      expect(candidate).toBe(packageName)
      return undici8
    })
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
  }
)
