/**
 * Forward a local port to a port inside a running sandbox.
 *
 * websocat runs in the sandbox, exposing the remote TCP port as a WebSocket
 * server on websocketPortFor(remote). The CLI listens on the local port and
 * tunnels each accepted connection over its own WebSocket. websocat keeps
 * running after the CLI exits so concurrent and later port-forwards to the same
 * remote port reuse it; it exposes nothing the sandbox proxy doesn't already
 * expose on the remote port itself.
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

      const handle = await startWebsocat(sandbox, wsPort, remotePort)
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

      setupSignalHandlers(() => process.exit(0))

      if (handle) {
        await handle.wait().catch(() => {})
        console.error(
          `websocat in sandbox exited: ${handle.stderr || handle.error || ''}`.trim()
        )
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

/**
 * Starts websocat in the sandbox, or returns undefined when an earlier
 * port-forward already runs one for the same ports.
 */
async function startWebsocat(
  sandbox: Sandbox,
  wsPort: number,
  remotePort: number
): Promise<CommandHandle | undefined> {
  const args = `ws-l:0.0.0.0:${wsPort} tcp:127.0.0.1:${remotePort}`

  const processes = await sandbox.commands.list()
  if (processes.some((p) => p.args.join(' ').endsWith(args))) {
    return undefined
  }

  if (!(await sandbox.files.exists(WEBSOCAT_SANDBOX_PATH))) {
    const arch = (await sandbox.commands.run('uname -m')).stdout.trim()
    await sandbox.commands.run(websocatInstallCommand(arch))
  }

  return sandbox.commands.run(
    `exec ${WEBSOCAT_SANDBOX_PATH} --binary --exit-on-eof ${args}`,
    { background: true, timeoutMs: 0 }
  )
}

/**
 * Waits until the sandbox proxy reaches websocat; until then it answers 502.
 */
async function waitForWebsocat(
  host: string,
  headers: Record<string, string>,
  handle: CommandHandle | undefined
): Promise<void> {
  let exited = false
  handle
    ?.wait()
    .catch(() => {})
    .finally(() => (exited = true))

  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        `websocat in sandbox exited: ${handle?.stderr || handle?.error || ''}`.trim()
      )
    }
    const res = await fetch(`https://${host}/`, { headers }).catch(
      () => undefined
    )
    await res?.body?.cancel()
    if (res && res.status !== 502) return
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS))
  }
  throw new Error(`Timed out waiting for websocat on ${host}`)
}
