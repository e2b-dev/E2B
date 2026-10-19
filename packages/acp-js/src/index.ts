import {
  ClientSideConnection,
  type Agent,
  type Client,
} from '@agentclientprotocol/sdk'
import type { Sandbox } from 'e2b'
import {
  startAcpTransport,
  type AcpAgentExit,
  type AcpStartOpts,
  type AcpStopOpts,
  type AcpTransport,
} from './transport'

export { DEFAULT_STOP_TIMEOUT_MS } from './transport'
export type { AcpAgentExit, AcpStartOpts, AcpStopOpts } from './transport'

/**
 * ACP agent running in a sandbox, connected to your client.
 */
export class AcpAgent {
  /**
   * @hidden
   * @internal
   */
  constructor(
    private readonly transport: AcpTransport,
    /**
     * Connection to the agent. Use it to initialize, create sessions and send prompts.
     */
    readonly connection: ClientSideConnection
  ) {}

  /**
   * Process ID of the agent in the sandbox.
   */
  get pid(): number {
    return this.transport.pid
  }

  /**
   * Wait for the agent process to exit.
   *
   * It rejects if the agent's output stream failed before its exit status was known.
   *
   * @returns exit status of the agent.
   */
  async wait(): Promise<AcpAgentExit> {
    return this.transport.wait()
  }

  /**
   * Stop the agent: send EOF to its stdin and kill it if it has not exited
   * within `timeoutMs` of this call. Messages the agent sends after this call
   * are not delivered.
   *
   * @param opts options for stopping the agent.
   *
   * @throws SandboxError if the agent could not be killed.
   */
  async stop(opts?: AcpStopOpts): Promise<void> {
    return this.transport.close(opts)
  }

  /**
   * Kill the agent process with `SIGKILL`.
   *
   * @returns `true` if the agent was killed, `false` if it was not found.
   */
  async kill(): Promise<boolean> {
    return this.transport.kill()
  }
}

/**
 * Start an [Agent Client Protocol](https://agentclientprotocol.com) agent in
 * the sandbox and connect your ACP client to it over the agent's stdin/stdout.
 *
 * The client filesystem and terminal capabilities are turned off in
 * `initialize`, and agent requests for `fs/*` or `terminal/*` are answered
 * with an error without reaching your client, so the agent edits files and
 * runs commands with its own tools in the sandbox. Network access and MCP
 * servers you pass to the agent are not restricted.
 *
 * @param sandbox sandbox with the agent installed.
 * @param command command that starts the agent in ACP mode, for example `goose acp`.
 * @param client your ACP client, or a function that creates it for the agent
 * connection. It answers permission requests and receives the agent's session updates.
 * @param opts options for starting the agent.
 *
 * @returns `AcpAgent` with the ACP connection.
 *
 * @throws InvalidArgumentError if `maxMessageBytes` is not a positive integer.
 * @throws SandboxError if the agent could not be started. Later, the
 * connection fails with a `SandboxError` if the agent exits with a non-zero
 * code or sends a message over `maxMessageBytes`.
 *
 * @example
 * ```ts
 * import { Sandbox } from 'e2b'
 * import { connectAcpAgent } from '@e2b/acp'
 * import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
 *
 * const sandbox = await Sandbox.create('goose')
 * const agent = await connectAcpAgent(sandbox, 'goose acp', client)
 * await agent.connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
 * // ...
 * await agent.stop()
 * ```
 */
export async function connectAcpAgent(
  sandbox: Sandbox,
  command: string,
  client: Client | ((agent: Agent) => Client),
  opts?: AcpStartOpts
): Promise<AcpAgent> {
  const transport = await startAcpTransport(sandbox, command, opts)
  const toClient = typeof client === 'function' ? client : () => client
  let connection: ClientSideConnection
  try {
    connection = new ClientSideConnection(toClient, transport.stream)
  } catch (err) {
    await transport.kill().catch(() => false)
    throw err
  }
  return new AcpAgent(transport, connection)
}
