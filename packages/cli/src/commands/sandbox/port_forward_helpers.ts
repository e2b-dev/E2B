import * as net from 'node:net'
import WebSocket, { createWebSocketStream } from 'ws'
import { z } from 'zod'

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
 * Commander parser for `local:remote`, or a single `port` used for both sides.
 */
export const parsePortMapping = zodParser(
  z
    .string()
    .regex(/^[^:]*(:[^:]*)?$/, 'Expected <local>:<remote> or <port>.')
    .transform((value) => {
      const [localPort, remotePort = localPort] = value.split(':')
      return { localPort, remotePort }
    })
    .pipe(z.object({ localPort: port, remotePort: port }))
)

/**
 * The sandbox port websocat listens on for `remotePort`: the port shifted by
 * half of the unprivileged range (1024-65535), wrapping around inside it. It
 * never equals `remotePort` and never needs root to bind.
 */
export function websocketPortFor(remotePort: number): number {
  return 1024 + ((remotePort + 31232) % 64512)
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
  const remote = createWebSocketStream(new WebSocket(url, { headers }))

  // A WebSocket can't half-close: after the local client stops writing, keep
  // relaying the sandbox's reply until either side closes the connection.
  socket.pipe(remote, { end: false })
  remote.pipe(socket)

  remote.on('error', () => {
    onError()
    socket.destroy()
  })
  socket.on('error', () => remote.destroy())
  socket.on('close', () => remote.destroy())
}
