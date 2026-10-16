import {
  ClientSideConnection,
  type Agent,
  type Client,
} from '@agentclientprotocol/sdk'
import type { Sandbox } from 'e2b'
import {
  startAcpTransport,
  type AcpAgentExit,
  type AcpCloseOpts,
  type AcpStartOpts,
  type AcpTransport,
} from './transport'

export type { AcpAgentExit, AcpCloseOpts, AcpStartOpts } from './transport'

/**
 * Options for connecting to an ACP agent in a sandbox.
 */
export interface ConnectAcpAgentOpts extends AcpStartOpts {
  /**
   * Command that starts the agent in ACP mode, for example `goose acp`.
   */
  command: string
  /**
   * Your ACP client, or a function that creates it for the agent connection.
   * It answers permission requests and receives the agent's session updates.
   */
  client: Client | ((agent: Agent) => Client)
}

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
   * Close the agent: send EOF to its stdin and kill it if it has not exited
   * within `timeoutMs` of this call. Messages the agent sends after this call
   * are not delivered. It rejects if the agent could not be killed.
   *
   * @param opts options for closing the agent.
   */
  async close(opts?: AcpCloseOpts): Promise<void> {
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
 * @param opts options for starting and connecting to the agent.
 *
 * @returns `AcpAgent` with the ACP connection.
 *
 * @example
 * ```ts
 * import { Sandbox } from 'e2b'
 * import { connectAcpAgent } from '@e2b/acp'
 * import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
 *
 * const sandbox = await Sandbox.create('goose')
 * const agent = await connectAcpAgent(sandbox, { command: 'goose acp', client })
 * await agent.connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
 * // ...
 * await agent.close()
 * ```
 */
export async function connectAcpAgent(
  sandbox: Sandbox,
  opts: ConnectAcpAgentOpts
): Promise<AcpAgent> {
  const { command, client, ...startOpts } = opts
  const transport = await startAcpTransport(sandbox, command, startOpts)
  const toClient = typeof client === 'function' ? client : () => client
  return new AcpAgent(
    transport,
    new ClientSideConnection(toClient, transport.stream)
  )
}
