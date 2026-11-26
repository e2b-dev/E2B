import { randomBytes } from 'node:crypto'
import * as http from 'node:http'
import * as https from 'node:https'
import * as net from 'node:net'
import WebSocket from 'ws'
import { z } from 'zod'
import { InvalidArgumentError } from '@commander-js/extra-typings'

import { integer, zodParser } from 'src/validation'

const WEBSOCAT_VERSION = 'v1.14.2'

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

const WEBSOCAT_SANDBOX_DIR = '/tmp/.e2b'
export const WEBSOCAT_SANDBOX_PATH = `${WEBSOCAT_SANDBOX_DIR}/websocat-${WEBSOCAT_VERSION}`

const port = integer('Port', { min: 1, max: 65535 })

/**
 * Commander parser for `local:remote`, a single `port` used for both sides, or
 * `:remote` for a random free local port (`localPort` 0).
 */
export const parsePortMapping = zodParser(
  z
    .string()
    .regex(
      /^[^:]*(:[^:]*)?$/,
      'Expected <local>:<remote>, <port> or :<remote>.'
    )
    .transform((value) => {
      const [localPort, remotePort = localPort] = value.split(':')
      return { localPort, remotePort }
    })
    .pipe(
      z.object({
        localPort: z.union([z.literal('').transform(() => 0), port]),
        remotePort: port,
      })
    )
)

export type PortMapping = ReturnType<typeof parsePortMapping>

/**
 * Commander parser for a variadic list of {@link parsePortMapping} arguments.
 * Rejects a local port given twice, which could only be bound once; random
 * local ports never clash.
 */
export function collectPortMapping(
  value: string,
  previous: PortMapping[] = []
): PortMapping[] {
  const mapping = parsePortMapping(value)
  if (
    mapping.localPort !== 0 &&
    previous.some(({ localPort }) => localPort === mapping.localPort)
  ) {
    throw new InvalidArgumentError(
      `Local port ${mapping.localPort} is forwarded more than once. Use a different <local> port for each mapping; a <remote> port can repeat.`
    )
  }
  return [...previous, mapping]
}

/**
 * The sandbox port websocat listens on for `remotePort`: the port shifted by
 * half of the unprivileged range (1024-65535), wrapping around inside it. It
 * never equals `remotePort` and never needs root to bind.
 */
export function websocketPortFor(remotePort: number): number {
  return 1024 + ((remotePort + 31232) % 64512)
}

/**
 * A random URI path for websocat's `--restrict-uri`. The relay's sandbox URL
 * can be public, so only clients that know this path reach the remote port.
 */
export function randomTunnelPath(): string {
  return `/${randomBytes(24).toString('base64url')}`
}

/**
 * Marker file the forward that starts websocat for these ports writes, so
 * concurrent forwards find its PID and secret path. Holds `<pid> <path>`.
 */
export function tunnelMarkerPath(wsPort: number, remotePort: number): string {
  return `${WEBSOCAT_SANDBOX_DIR}/port-forward-${wsPort}-${remotePort}`
}

/**
 * Parses a {@link tunnelMarkerPath} file, or returns undefined if it's malformed.
 */
export function parseTunnelMarker(
  content: string
): { pid: number; path: string } | undefined {
  const match = content.trim().match(/^(\d+) (\/[A-Za-z0-9_-]+)$/)
  return match ? { pid: Number(match[1]), path: match[2] } : undefined
}

/**
 * Shell command that writes the marker and then becomes websocat, so the
 * marker's PID is websocat's. noclobber makes a concurrent start fail instead
 * of overwriting the marker of the websocat that owns the port.
 */
export function websocatStartCommand(
  wsPort: number,
  remotePort: number,
  path: string
): string {
  const marker = tunnelMarkerPath(wsPort, remotePort)
  return [
    'set -C',
    'umask 077',
    `printf '%s %s\\n' "$$" '${path}' > ${marker}`,
    `exec ${WEBSOCAT_SANDBOX_PATH} --binary --exit-on-eof --restrict-uri ${path} ws-l:0.0.0.0:${wsPort} tcp:127.0.0.1:${remotePort}`,
  ].join(' && ')
}

/**
 * Shell command that removes the marker if it still belongs to `pid`.
 */
export function removeTunnelMarkerCommand(
  wsPort: number,
  remotePort: number,
  pid: number
): string {
  const marker = tunnelMarkerPath(wsPort, remotePort)
  return `[ "$(cut -d' ' -f1 ${marker} 2>/dev/null)" = ${pid} ] && rm -f ${marker} || true`
}

/**
 * Shell command that downloads websocat for `arch` (`uname -m` in the
 * sandbox) to WEBSOCAT_SANDBOX_PATH and verifies its checksum.
 */
export function websocatInstallCommand(arch: string): string {
  const binary = WEBSOCAT_BINARIES[arch]
  if (!binary) {
    throw new Error(`Port forwarding is not supported on ${arch} sandboxes.`)
  }

  const url = `https://github.com/vi/websocat/releases/download/${WEBSOCAT_VERSION}/${binary.asset}`
  const tmp = `${WEBSOCAT_SANDBOX_PATH}.$$.download`
  return [
    'set -e',
    `mkdir -p ${WEBSOCAT_SANDBOX_DIR}`,
    `if command -v curl >/dev/null; then curl -fsSL -o ${tmp} ${url}; else wget -qO ${tmp} ${url}; fi`,
    `echo "${binary.sha256}  ${tmp}" | sha256sum -c - >/dev/null`,
    `chmod +x ${tmp}`,
    `mv ${tmp} ${WEBSOCAT_SANDBOX_PATH}`,
  ].join('\n')
}

const HIGH_WATER_MARK = 1024 * 1024

/**
 * Pipes a local TCP socket through a WebSocket until either side closes.
 * Both directions apply backpressure, so a slow reader pauses the other side.
 */
export function tunnelSocket(
  socket: net.Socket,
  url: string,
  headers: Record<string, string>,
  onError: () => void
): void {
  socket.pause()

  // ws bypasses the global agent by default, which ignores the proxy Node
  // configures from HTTPS_PROXY when NODE_USE_ENV_PROXY is set.
  const agent = url.startsWith('wss:') ? https.globalAgent : http.globalAgent
  const ws = new WebSocket(url, { headers, agent })

  ws.on('open', () => socket.resume())
  ws.on('message', (data: Buffer) => {
    if (!socket.destroyed && !socket.write(data)) ws.pause()
  })
  socket.on('drain', () => ws.resume())
  ws.on('close', () => socket.end())
  ws.on('error', () => {
    if (!socket.destroyed) onError()
    socket.destroy()
  })

  socket.on('data', (chunk) => {
    // Once the sandbox closes, drop the rest of the upload so the reply it
    // already sent still reaches the client.
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(chunk, () => {
      if (ws.bufferedAmount < HIGH_WATER_MARK) socket.resume()
    })
    if (ws.bufferedAmount >= HIGH_WATER_MARK) socket.pause()
  })
  // A WebSocket can't half-close: after the local client stops writing, keep
  // relaying the sandbox's reply until either side closes the connection.
  socket.on('close', () => {
    // The socket will never drain now; resume so ws can read the close reply.
    ws.resume()
    if (ws.readyState === WebSocket.OPEN) ws.close()
    else ws.terminate()
  })
  socket.on('error', () => {})
}
