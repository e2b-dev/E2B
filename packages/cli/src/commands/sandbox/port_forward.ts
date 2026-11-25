/**
 * Forward a local port to a port inside a running sandbox.
 *
 * websocat runs in the sandbox, exposing the remote TCP port as a WebSocket
 * server on websocketPortFor(remote). The CLI listens on the local port and
 * tunnels each accepted connection over its own WebSocket. The CLI kills the
 * websocat it started when it exits; a concurrent port-forward to the same
 * remote port shares that websocat and exits with it.
 */

import * as net from 'node:net'
import { CommandHandle, Sandbox } from 'e2b'
import * as commander from '@commander-js/extra-typings'

import { ensureAuth } from '../../api'
import { asBold, asPrimary } from 'src/utils/format'
import { setupSignalHandlers } from 'src/utils/signal'
import {
  parsePortMapping,
  tunnelSocket,
  WEBSOCAT_SANDBOX_PATH,
  websocatInstallCommand,
  websocketPortFor,
} from './port_forward_helpers'

const READY_TIMEOUT_MS = 15_000
const READY_POLL_MS = 200

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
    try {
      const sandbox = await Sandbox.connect(sandboxID, await ensureAuth())
      const wsPort = websocketPortFor(remotePort)
      const headers: Record<string, string> = sandbox.trafficAccessToken
        ? { 'e2b-traffic-access-token': sandbox.trafficAccessToken }
        : {}

      const { handle, owned } = await startWebsocat(sandbox, wsPort, remotePort)
      setupSignalHandlers(async () => {
        if (owned) await handle.kill().catch(() => {})
        process.exit(0)
      })
      await waitForWebsocat(sandbox.getHost(wsPort), headers, handle)

      const url = `wss://${sandbox.getHost(wsPort)}`
      const server = net.createServer((socket) =>
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

      await handle.wait().catch(() => {})
      console.error(
        `websocat in sandbox exited: ${handle.stderr || handle.error || ''}`.trim()
      )
      process.exit(1)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

/**
 * Starts websocat in the sandbox, or connects to the one a concurrent
 * port-forward already runs for the same ports. `owned` is false in that case.
 */
async function startWebsocat(
  sandbox: Sandbox,
  wsPort: number,
  remotePort: number
): Promise<{ handle: CommandHandle; owned: boolean }> {
  const args = `ws-l:0.0.0.0:${wsPort} tcp:127.0.0.1:${remotePort}`

  const processes = await sandbox.commands.list()
  const running = processes.find((p) => p.args.join(' ').endsWith(args))
  if (running) {
    return { handle: await sandbox.commands.connect(running.pid), owned: false }
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

  const handle = await sandbox.commands.run(
    `exec ${WEBSOCAT_SANDBOX_PATH} --binary --exit-on-eof ${args}`,
    { background: true, timeoutMs: 0 }
  )
  return { handle, owned: true }
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
