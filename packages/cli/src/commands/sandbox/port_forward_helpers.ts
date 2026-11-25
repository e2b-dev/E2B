import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import * as commander from '@commander-js/extra-typings'

export const WEBSOCAT_VERSION = 'v1.14.2'

const WEBSOCAT_BINARIES: Record<string, { asset: string; sha256: string }> = {
  x86_64: {
    asset: 'websocat.x86_64-unknown-linux-musl',
    sha256: 'cd26f92cb507f620e2d54fe6e126f4dc191f3eee90f2b53bccf07eac0645ec84',
  },
  aarch64: {
    asset: 'websocat.aarch64-unknown-linux-musl',
    sha256: 'cdd6b0bee24c81c537cb9ef257b433625355e0bbe002235f8df1e70acbd2c1dd',
  },
}

export interface PortMapping {
  localPort: number
  remotePort: number
}

function parsePort(value: string): number {
  const port = Number(value)
  if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new commander.InvalidArgumentError(
      `Invalid port "${value}", expected a number between 1 and 65535.`
    )
  }
  return port
}

/**
 * Parses `local:remote`, or a single `port` used for both sides.
 */
export function parsePortMapping(value: string): PortMapping {
  const parts = value.split(':')
  if (parts.length > 2) {
    throw new commander.InvalidArgumentError(
      `Invalid port mapping "${value}", expected <local>:<remote>.`
    )
  }
  const localPort = parsePort(parts[0])
  const remotePort = parts.length === 2 ? parsePort(parts[1]) : localPort
  return { localPort, remotePort }
}

/**
 * The sandbox port websocat listens on for `remotePort`: `80{remote}` for
 * ports below 100, else `50000 + remote % 10000`.
 */
export function websocketPortFor(remotePort: number): number {
  const prefixed = Number(`80${remotePort}`)
  if (prefixed <= 65535) return prefixed
  return 50000 + (remotePort % 10000)
}

export function websocatSandboxPath(): string {
  return `/tmp/.e2b/websocat-${WEBSOCAT_VERSION}`
}

/**
 * Returns the websocat binary for `arch` (`uname -m` in the sandbox),
 * downloading it into ~/.e2b/cache on first use.
 */
export async function getWebsocatBinary(
  arch: string,
  cacheDir = path.join(os.homedir(), '.e2b', 'cache', 'websocat')
): Promise<Buffer> {
  const binary = WEBSOCAT_BINARIES[arch]
  if (!binary) {
    throw new Error(`Port forwarding is not supported on ${arch} sandboxes.`)
  }

  const cachePath = path.join(cacheDir, WEBSOCAT_VERSION, binary.asset)
  const cached = await fs.readFile(cachePath).catch(() => undefined)
  if (cached && sha256(cached) === binary.sha256) return cached

  const url = `https://github.com/vi/websocat/releases/download/${WEBSOCAT_VERSION}/${binary.asset}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download websocat from ${url}: ${res.status}`)
  }
  const data = Buffer.from(await res.arrayBuffer())
  if (sha256(data) !== binary.sha256) {
    throw new Error(`Checksum mismatch for websocat downloaded from ${url}`)
  }

  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  await fs.writeFile(cachePath, data, { mode: 0o755 })
  return data
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

const HIGH_WATER_MARK = 1024 * 1024
const DRAIN_POLL_MS = 10

/**
 * Pipes a local TCP socket through a WebSocket until either side closes.
 */
export function tunnelSocket(
  socket: net.Socket,
  url: string,
  headers: Record<string, string>,
  onError: () => void
): void {
  socket.pause()

  // Node's WebSocket (undici) accepts headers; the DOM typings don't know it.
  const ws = new WebSocket(url, { headers } as unknown as string[])
  ws.binaryType = 'arraybuffer'

  let drainTimer: NodeJS.Timeout | undefined
  const waitForDrain = () => {
    if (drainTimer) return
    socket.pause()
    drainTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(drainTimer)
        return
      }
      if (ws.bufferedAmount < HIGH_WATER_MARK) {
        clearInterval(drainTimer)
        drainTimer = undefined
        socket.resume()
      }
    }, DRAIN_POLL_MS)
  }

  ws.addEventListener('open', () => socket.resume())
  ws.addEventListener('message', (event) => {
    socket.write(Buffer.from(event.data as ArrayBuffer))
  })
  ws.addEventListener('close', () => {
    clearInterval(drainTimer)
    socket.end()
  })
  ws.addEventListener('error', () => {
    onError()
    socket.destroy()
  })

  socket.on('data', (chunk) => {
    ws.send(chunk)
    if (ws.bufferedAmount >= HIGH_WATER_MARK) waitForDrain()
  })
  socket.on('end', () => ws.close())
  socket.on('error', () => ws.close())
}
