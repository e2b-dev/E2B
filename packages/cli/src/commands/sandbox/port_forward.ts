/**
 * Forward local ports to ports inside a running sandbox.
 *
 * For each remote port, websocat runs in the sandbox, exposing the remote TCP
 * port as a WebSocket server on websocketPortFor(remote). The CLI listens on
 * the local ports and tunnels each accepted connection over its own WebSocket.
 * The CLI kills the websocats it started when it exits, and exits when any of
 * its websocats does; a concurrent port-forward to the same remote port shares
 * that websocat and exits with it.
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
  collectPortMapping,
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

type Tunnel = {
  handle: CommandHandle
  owned: boolean
  path: string
  wsPort: number
  remotePort: number
}

export const portForwardCommand = new commander.Command('port-forward')
  .description('forward local ports to ports in a running sandbox')
  .argument('<sandboxID>', 'sandbox ID to forward the ports to')
  .argument(
    '<local:remote...>',
    `forward ${asBold('<local>')} on this machine to ${asBold('<remote>')} in the sandbox, repeat to forward several ports`,
    collectPortMapping
  )
  .alias('pf')
  .action(async (sandboxID, mappings) => {
    let sandbox: Sandbox | undefined
    const tunnels: Tunnel[] = []
    let stopping = false
    const stop = async () => {
      stopping = true
      await Promise.all(
        tunnels
          .filter((tunnel) => tunnel.owned)
          .map(async ({ handle: { pid }, wsPort, remotePort }) => {
            await sandbox?.commands.kill(pid).catch(() => {})
            await sandbox?.commands
              .run(removeTunnelMarkerCommand(wsPort, remotePort, pid))
              .catch(() => {})
          })
      )
    }

    try {
      sandbox = await Sandbox.connect(sandboxID, await ensureAuth())
      const connected = sandbox
      const headers: Record<string, string> = sandbox.trafficAccessToken
        ? { 'e2b-traffic-access-token': sandbox.trafficAccessToken }
        : {}

      await installWebsocat(sandbox)
      const remotePorts = [...new Set(mappings.map((m) => m.remotePort))]
      // allSettled so a failed start can't leave another websocat running
      // unseen by stop().
      const started = await Promise.allSettled(
        remotePorts.map(async (remotePort) => {
          const tunnel = await startWebsocat(connected, remotePort)
          tunnels.push(tunnel)
          return tunnel
        })
      )
      // Not setupSignalHandlers: it also catches SIGPIPE, which a local client
      // resetting its connection raises and must not stop the forward.
      for (const signal of STOP_SIGNALS) {
        process.on(signal, async () => {
          await stop()
          process.exit(0)
        })
      }
      const failed = started.find((result) => result.status === 'rejected')
      if (failed) throw failed.reason
      await Promise.all(
        tunnels.map(({ wsPort, handle }) =>
          waitForWebsocat(connected.getHost(wsPort), headers, handle)
        )
      )

      for (const { localPort, remotePort } of mappings) {
        const { wsPort, path } = tunnels.find(
          (tunnel) => tunnel.remotePort === remotePort
        )!
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
      }

      const exited = await Promise.race(
        tunnels.map(async (tunnel) => ({
          tunnel,
          handle: await waitForExit(connected, tunnel.handle),
        }))
      )
      if (stopping) return
      const { handle, tunnel } = exited
      console.error(
        `websocat for sandbox port ${tunnel.remotePort} exited: ${handle.stderr || handle.error || ''}`.trim()
      )
      await stop()
      process.exit(1)
    } catch (err: any) {
      if (stopping) return
      console.error(err)
      await stop()
      process.exit(1)
    }
  })

/**
 * Downloads websocat into the sandbox unless it's already there.
 */
async function installWebsocat(sandbox: Sandbox): Promise<void> {
  if (await sandbox.files.exists(WEBSOCAT_SANDBOX_PATH)) return
  console.log('Downloading websocat into the sandbox...')
  const arch = (await sandbox.commands.run('uname -m')).stdout.trim()
  await sandbox.commands.run(websocatInstallCommand(arch)).catch((err) => {
    throw new Error(
      `Failed to download websocat in the sandbox: ${err.stderr || err.message}. ` +
        'Check that the sandbox has internet access and can reach github.com.'
    )
  })
}

/**
 * Starts websocat in the sandbox for `remotePort`, or connects to the one a
 * concurrent port-forward already runs for it. `owned` is false in that case.
 * `path` is the secret URI path websocat accepts WebSocket connections on.
 */
async function startWebsocat(
  sandbox: Sandbox,
  remotePort: number
): Promise<Tunnel> {
  const wsPort = websocketPortFor(remotePort)
  const marker = tunnelMarkerPath(wsPort, remotePort)
  const existing = parseTunnelMarker(
    await sandbox.files.read(marker).catch(() => '')
  )
  if (existing) {
    const handle = await sandbox.commands
      .connect(existing.pid, { timeoutMs: 0 })
      .catch(() => undefined)
    if (handle) {
      return { handle, owned: false, path: existing.path, wsPort, remotePort }
    }
  }
  // A missing, malformed or stale marker (e.g. the CLI that started websocat
  // crashed) would otherwise make the noclobber write below fail.
  await sandbox.files.remove(marker).catch(() => {})

  const path = randomTunnelPath()
  const handle = await sandbox.commands.run(
    websocatStartCommand(wsPort, remotePort, path),
    { background: true, timeoutMs: 0 }
  )
  return { handle, owned: true, path, wsPort, remotePort }
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
