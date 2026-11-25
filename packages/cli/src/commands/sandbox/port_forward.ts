/**
 * Forward a local port to a port inside a running sandbox.
 *
 * websocat runs in the sandbox, exposing the remote TCP port as a WebSocket
 * server on websocketPortFor(remote). The CLI listens on the local port and
 * tunnels each accepted connection over its own WebSocket. The CLI kills the
 * websocat it started when it exits; a concurrent port-forward to the same
 * remote port shares that websocat and exits with it.
 */

import * as os from 'node:os'
import * as net from 'node:net'
import {
  AuthenticationError,
  CommandExitError,
  CommandHandle,
  Sandbox,
  SandboxNotFoundError,
} from 'e2b'
import * as commander from '@commander-js/extra-typings'

import { ensureAuth } from '../../api'
import { asBold, asPrimary } from 'src/utils/format'
import {
  parsePortMapping,
  parseTunnelMarker,
  randomTunnelPath,
  removeTunnelMarkerCommand,
  tunnelMarkerPath,
  tunnelSocket,
  WEBSOCAT_SANDBOX_PATH,
  websocatInstallCommand,
  websocatStartCommand,
  websocketPortFor,
} from './port_forward_helpers'

const READY_TIMEOUT_MS = 15_000
const READY_POLL_MS = 200
const RECONNECT_DELAY_MS = 1_000
const STOP_SIGNALS = (
  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const
).filter((signal) => signal in os.constants.signals)

export const portForwardCommand = new commander.Command('port-forward')
  .description('forward a local port to a port in a running sandbox')
  .argument('<sandboxID>', 'sandbox ID to forward the port to')
  .argument(
    '<local:remote>',
    `forward ${asBold('<local>')} on this machine to ${asBold('<remote>')} in the sandbox`,
    parsePortMapping
  )
  .alias('pf')
  .action(async (sandboxID, { localPort, remotePort }) => {
    let sandbox: Sandbox | undefined
    let websocat:
      { handle: CommandHandle; owned: boolean; path: string } | undefined
    let stopping = false
    const wsPort = websocketPortFor(remotePort)
    const stop = async () => {
      stopping = true
      if (sandbox && websocat?.owned) {
        const { pid } = websocat.handle
        await sandbox.commands.kill(pid).catch(() => {})
        await sandbox.commands
          .run(removeTunnelMarkerCommand(wsPort, remotePort, pid))
          .catch(() => {})
      }
    }

    try {
      sandbox = await Sandbox.connect(sandboxID, await ensureAuth())
      const headers: Record<string, string> = sandbox.trafficAccessToken
        ? { 'e2b-traffic-access-token': sandbox.trafficAccessToken }
        : {}

      websocat = await startWebsocat(sandbox, wsPort, remotePort)
      const { handle, path } = websocat
      // Not setupSignalHandlers: it also catches SIGPIPE, which a local client
      // resetting its connection raises and must not stop the forward.
      for (const signal of STOP_SIGNALS) {
        process.on(signal, async () => {
          await stop()
          process.exit(0)
        })
      }
      await waitForWebsocat(sandbox.getHost(wsPort), headers, handle)

      const url = `wss://${sandbox.getHost(wsPort)}${path}`
      const server = net.createServer({ allowHalfOpen: true }, (socket) =>
        tunnelSocket(socket, url, headers, () =>
          console.error(
            `Connection to sandbox port ${remotePort} failed, is anything listening on it?`
          )
        )
      )
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(localPort, '127.0.0.1', resolve)
      })

      console.log(
        `Forwarding 127.0.0.1:${localPort} -> sandbox ${asPrimary(sandbox.sandboxId)} port ${remotePort}`
      )

      const exited = await waitForExit(sandbox, handle)
      if (stopping) return
      console.error(
        `websocat in sandbox exited: ${exited.stderr || exited.error || ''}`.trim()
      )
      process.exit(1)
    } catch (err: any) {
      if (stopping) return
      console.error(err)
      await stop()
      process.exit(1)
    }
  })

/**
 * Starts websocat in the sandbox, or connects to the one a concurrent
 * port-forward already runs for the same ports. `owned` is false in that case.
 * `path` is the secret URI path websocat accepts WebSocket connections on.
 */
async function startWebsocat(
  sandbox: Sandbox,
  wsPort: number,
  remotePort: number
): Promise<{ handle: CommandHandle; owned: boolean; path: string }> {
  const marker = tunnelMarkerPath(wsPort, remotePort)
  const existing = parseTunnelMarker(
    await sandbox.files.read(marker).catch(() => '')
  )
  if (existing) {
    const handle = await sandbox.commands
      .connect(existing.pid, { timeoutMs: 0 })
      .catch(() => undefined)
    if (handle) return { handle, owned: false, path: existing.path }
    // websocat is gone without cleaning up, e.g. the CLI that started it crashed.
    await sandbox.files.remove(marker).catch(() => {})
  }

  if (!(await sandbox.files.exists(WEBSOCAT_SANDBOX_PATH))) {
    console.log('Downloading websocat into the sandbox...')
    const arch = (await sandbox.commands.run('uname -m')).stdout.trim()
    await sandbox.commands.run(websocatInstallCommand(arch)).catch((err) => {
      throw new Error(
        `Failed to download websocat in the sandbox: ${err.stderr || err.message}. ` +
          'Check that the sandbox has internet access and can reach github.com.'
      )
    })
  }

  const path = randomTunnelPath()
  const handle = await sandbox.commands.run(
    websocatStartCommand(wsPort, remotePort, path),
    { background: true, timeoutMs: 0 }
  )
  return { handle, owned: true, path }
}

/**
 * Waits until the sandbox proxy reaches websocat; until then it answers 502.
 */
async function waitForWebsocat(
  host: string,
  headers: Record<string, string>,
  handle: CommandHandle
): Promise<void> {
  let exited = false
  handle
    .wait()
    .catch(() => {})
    .finally(() => (exited = true))

  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        `websocat in sandbox exited: ${handle.stderr || handle.error || ''}`.trim()
      )
    }
    const res = await fetch(`https://${host}/`, {
      headers,
      signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
    }).catch(() => undefined)
    await res?.body?.cancel()
    if (res && res.status !== 502) return
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS))
  }
  throw new Error(
    `Timed out after ${READY_TIMEOUT_MS / 1000}s waiting for the sandbox proxy to reach websocat on ${host}. ` +
      'Check that the sandbox is still running (`e2b sandbox list`) and retry.'
  )
}

/**
 * Waits until websocat exits. A dropped command stream is not an exit: as long
 * as websocat still runs in the sandbox, reconnect to it and keep waiting.
 */
async function waitForExit(
  sandbox: Sandbox,
  handle: CommandHandle
): Promise<CommandHandle> {
  for (;;) {
    try {
      await handle.wait()
      return handle
    } catch (err) {
      if (err instanceof CommandExitError) return handle
    }
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS))
    const processes = await sandbox.commands.list().catch(() => undefined)
    const running = processes
      ? processes.some((p) => p.pid === handle.pid)
      : await sandbox.getInfo().then(
          (info) => info.state === 'running',
          (err) => {
            // An expired login never recovers, so retrying would keep the
            // local port bound forever.
            if (err instanceof AuthenticationError) throw err
            return !(err instanceof SandboxNotFoundError)
          }
        )
    if (!running) return handle
    handle = await sandbox.commands
      .connect(handle.pid, { timeoutMs: 0 })
      .catch(() => handle)
  }
}
