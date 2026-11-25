import * as net from 'node:net'
import { afterEach, describe, expect, test } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { tunnelSocket } from '../../../src/commands/sandbox/port_forward_helpers'

const MB = 1024 * 1024

const closers: (() => void)[] = []
afterEach(() => closers.splice(0).forEach((close) => close()))

async function startTunnel(onConnection: (ws: WebSocket) => void) {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  wss.on('connection', onConnection)
  await new Promise((resolve) => wss.once('listening', resolve))
  const url = `ws://127.0.0.1:${(wss.address() as net.AddressInfo).port}`

  const server = net.createServer({ allowHalfOpen: true }, (socket) =>
    tunnelSocket(socket, url, {}, () => {})
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  closers.push(() => {
    server.close()
    wss.clients.forEach((client) => client.terminate())
    wss.close()
  })
  return (server.address() as net.AddressInfo).port
}

describe('tunnelSocket', () => {
  test('relays the reply after the client half-closes', async () => {
    const port = await startTunnel((ws) =>
      ws.on('message', (data) => ws.send(`echo ${data}`))
    )

    const reply = await new Promise<string>((resolve, reject) => {
      let received = ''
      const client = net.connect(port, '127.0.0.1', () => client.end('ping'))
      client.on('data', (chunk) => {
        received += chunk
        client.destroy()
      })
      client.on('close', () => resolve(received))
      client.on('error', reject)
    })
    expect(reply).toBe('echo ping')
  })

  test('stops reading from the sandbox while the local client is not reading', async () => {
    let sandboxSide: WebSocket | undefined
    const port = await startTunnel((ws) => {
      sandboxSide = ws
      const chunk = Buffer.alloc(MB)
      for (let i = 0; i < 64; i++) ws.send(chunk)
    })

    const client = net.connect(port, '127.0.0.1')
    client.pause()
    closers.push(() => client.destroy())
    await new Promise((resolve) => setTimeout(resolve, 1_000))

    // Without backpressure the tunnel would drain the sandbox side into memory.
    expect(sandboxSide!.bufferedAmount).toBeGreaterThan(24 * MB)
  })
})
