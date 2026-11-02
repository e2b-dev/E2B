import { afterEach, expect, test, vi } from 'vitest'
import type { AddressInfo, Server, Socket } from 'node:net'

import { ConnectionConfig, Sandbox } from '../../src'
import { runtime } from '../../src/utils'

// The suite-wide setup swaps undici for the global fetch so msw can intercept;
// this file needs the real dispatcher to see what envd connections negotiate.
vi.unmock('../../src/undici')

const servers: Server[] = []

afterEach(async () => {
  delete process.env.E2B_HTTP_VERSION
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve)))
  )
})

/**
 * Reads the ALPN protocols offered in a TLS ClientHello, or `[]` when the
 * hello carries no ALPN extension.
 */
function offeredAlpn(record: Buffer): string[] {
  // record header (5) + handshake header (4) + version (2) + random (32)
  let offset = 5 + 4 + 2 + 32
  offset += 1 + record[offset] // session id
  offset += 2 + record.readUInt16BE(offset) // cipher suites
  offset += 1 + record[offset] // compression methods
  const extensionsEnd = offset + 2 + record.readUInt16BE(offset)
  offset += 2

  while (offset < extensionsEnd) {
    const type = record.readUInt16BE(offset)
    const length = record.readUInt16BE(offset + 2)
    offset += 4
    if (type === 0x0010) {
      const protocols: string[] = []
      const listEnd = offset + 2 + record.readUInt16BE(offset)
      for (let i = offset + 2; i < listEnd; i += 1 + record[i]) {
        protocols.push(record.toString('latin1', i + 1, i + 1 + record[i]))
      }
      return protocols
    }
    offset += length
  }

  return []
}

/**
 * A fake envd endpoint that records the ALPN protocols each incoming TLS
 * connection offers, then drops the connection.
 */
async function startEnvd() {
  const net = await import('node:net')
  const offers: string[][] = []

  const onConnection = (socket: Socket, head = Buffer.alloc(0)) => {
    let data = head
    const read = (chunk: Buffer) => {
      data = Buffer.concat([data, chunk])
      if (data.length < 5 || data.length < 5 + data.readUInt16BE(3)) return
      offers.push(offeredAlpn(data))
      socket.destroy()
    }
    socket.on('error', () => {})
    if (head.length) read(Buffer.alloc(0))
    socket.on('data', read)
  }

  const server = net.createServer((socket) => onConnection(socket))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  return {
    url: `https://127.0.0.1:${(server.address() as AddressInfo).port}`,
    offers,
    onConnection,
  }
}

/** An HTTP CONNECT proxy that records each tunnel target. */
async function startProxy(forward: (socket: Socket, head: Buffer) => void) {
  const http = await import('node:http')
  const targets: string[] = []

  const server = http.createServer()
  server.on('connect', (req, socket: Socket, head: Buffer) => {
    targets.push(req.url ?? '')
    socket.on('error', () => {})
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    forward(socket, head)
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    targets,
  }
}

function createSandbox(
  sandboxUrl: string,
  opts: { httpVersion?: '1.1' | '2'; proxy?: string } = {}
) {
  return new Sandbox({
    ...new ConnectionConfig({ ...opts, sandboxUrl, retries: 0 }),
    sandboxId: 'sbx-test',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
  })
}

// Outside Node the SDK uses the runtime's own fetch, which picks the protocol
// itself, so there is no envd dispatcher to configure.
const nodeTest = test.skipIf(runtime !== 'node')

nodeTest('envd HTTP and RPC requests offer HTTP/2 by default', async () => {
  const envd = await startEnvd()
  const sandbox = createSandbox(envd.url)

  await expect(sandbox.files.read('/hello.txt')).rejects.toThrow()
  expect(envd.offers).toEqual([['http/1.1', 'h2']])

  envd.offers.length = 0
  await expect(sandbox.files.list('/')).rejects.toThrow()
  expect(envd.offers).toEqual([['http/1.1', 'h2']])
})

nodeTest(
  'httpVersion: 1.1 pins envd HTTP and RPC requests to HTTP/1.1 through the proxy',
  async () => {
    const envd = await startEnvd()
    const proxy = await startProxy(envd.onConnection)
    const sandbox = createSandbox(envd.url, {
      httpVersion: '1.1',
      proxy: proxy.url,
    })
    const envdHost = new URL(envd.url).host

    await expect(sandbox.files.read('/hello.txt')).rejects.toThrow()
    expect(proxy.targets).toEqual([envdHost])
    expect(envd.offers).toEqual([['http/1.1']])

    proxy.targets.length = 0
    envd.offers.length = 0
    await expect(sandbox.files.list('/')).rejects.toThrow()
    expect(proxy.targets).toEqual([envdHost])
    expect(envd.offers).toEqual([['http/1.1']])
  }
)
